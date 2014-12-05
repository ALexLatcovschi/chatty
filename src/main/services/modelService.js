angular.module('chatty')
    .service('modelService', function(settingsService) {
        var modelService = {};

        var threads = [];
        var newThreads = [];
        var posts = {};
        var username = settingsService.getUsername();

        modelService.addThread = function addThread(post, event) {
            var thread = fixThread(post);
            if (event) {
                newThreads.push(thread);
            } else {
                threads.push(thread);
            }
            posts[thread.threadId] = thread;
        };

        modelService.getThreads = function getThreads() {
            return threads;
        };

        modelService.getNewThreads = function getNewThreads() {
            return newThreads;
        };

        modelService.addPost = function addPost(post) {
            var thread = posts[post.threadId];
            var parent = posts[post.parentId];
            if (parent && thread) {
                var fixedPost = fixPost(post, thread);
                updateLineClass(fixedPost, thread);

                if (thread.autoRefresh) {
                    parent.posts.push(fixedPost);
                } else {
                    thread.newPosts.push(fixedPost);
                }

                thread.replyCount++;
                posts[fixedPost.id] = fixedPost;
            }
        };

        modelService.getPost = function getPost(id) {
            return posts[id];
        };

        modelService.getPostThread = function getPostThread(post) {
            if (post.parentId > 0) {
                return modelService.getPost(post.threadId);
            } else {
                return post;
            }
        };

        modelService.changeCategory = function changeCategory(id, category) {
            var post = posts[id];
            if (post) {
                if (category === 'nuked') {
                    //remove if it's a root post
                    _.pull(threads, post);

                    //recursively remove all children
                    removePost(post);

                    //update reply count
                    countReplies(post);
                } else {
                    post.category = category;
                }
            }
        };

        modelService.cleanCollapsed = function cleanCollapsed() {
            settingsService.cleanCollapsed(posts);
        };

        modelService.clear = function clear() {
            while(threads.length) {
                threads.pop();
            }
            posts = {};
        };

        function fixThread(thread) {
            var threadPosts = _.sortBy(thread.posts, 'id');

            //handle root post
            if (thread.posts) {
                var rootPost = _.find(threadPosts, { parentId: 0 });
                _.pull(threadPosts, rootPost);
                thread.id = rootPost.id;
                thread.threadId = rootPost.id;
                thread.parentId = 0;
                thread.author = rootPost.author;
                thread.date = rootPost.date;
                thread.category = rootPost.category;
                thread.body = rootPost.body;
            }
            thread.replyCount = threadPosts.length || 0;
            thread.recent = [];
            thread.posts = [];
            thread.newPosts = [];
            posts[thread.id] = thread;
            fixPost(thread);

            while(threadPosts.length > 0) {
                var post = threadPosts.shift();

                //various post fixes
                fixPost(post, thread);

                //add to post list
                posts[post.id] = post;

                //create nested replies
                var parent = posts[post.parentId];
                parent.posts.push(post);

                //line coloring
                if (threadPosts.length < 10) {
                    updateLineClass(post, thread);
                }
            }

            //check if it's supposed to be collapsed
            if (settingsService.isCollapsed(thread.threadId)) {
                thread.state = 'collapsed';
            } else if (thread.replyCount > 15) {
                thread.state = 'truncated';
            }

            return thread;
        }

        function fixPost(post, thread) {
            //fix Shacknews posts with article links
            if (post.author === 'Shacknews') {
                post.body = post.body.replace('href="', 'href="http://www.shacknews.com');
            }

            //fix spoiler tags not being clickable
            post.body = post.body.replace(/onclick=[^>]+/gm, 'tabindex="1"');

            //create the one-liner used for reply view
            var stripped = _.unescape(post.body.replace(/(<(?!span)(?!\/span)[^>]+>| tabindex="1")/gm, ''));
            post.oneline = stripped.slice(0, 106) + (stripped.length > 106 ? '...' : '');

            //create sub-post container
            post.posts = post.posts || [];

            if (thread) {
                //add user class highlight
                if (post.author === thread.author) {
                    post.userClass = 'user_op';
                } else if (post.author === username) {
                    post.userClass = 'user_me';
                }
            }

            return post;
        }

        function updateLineClass(post, thread) {
            thread.recent.push(post);

            if (thread.recent.length > 10) {
                thread.recent.shift();
            }

            _.each(thread.recent, function(recentPost, index) {
                recentPost.lineClass = 'oneline' + (9 - index);
            });
        }

        function removePost(post) {
            delete posts[post.id];
            _.each(post.posts, removePost);
        }

        function countReplies(post) {
            return _.reduce(post.posts, function(result, subreply) {
                return result + countReplies(subreply) + 1;
            }, 0);
        }

        return modelService;
    });