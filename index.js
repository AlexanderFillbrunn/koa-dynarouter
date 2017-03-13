const jwt = require('koa-jwt');
const util = require('./util');
const _ = require('lodash');

// Methods the router responds to
const methods = {
    // Gets a particular resource identified by hash key and optional range key
    get: {factory: require('./methods/get'), detailPath: true},
    // Gets a collection of resources
    query: {factory: require('./methods/query'), method: 'get'},
    // Deletes a particular resource identified by hash key and optional range key
    del: {factory: require('./methods/del'), detailPath: true},
    // Inserts a resource into a collection
    post: {factory: require('./methods/post')},
    // Puts a resource at a certain location
    put: {factory: require('./methods/put'), detailPath: true},
    // Modifies a resource
    patch: {factory: require('./methods/patch'), detailPath: true}
};

/**
 * Creates a koa-router from a dynamoose model.
 * Available methods and their behavior is controlled by the options argument.
* @function {dynamoose}
* @param  {object} model   The Dynamoose model to create the router for
* @param  {object} options An object containing options for the different methods
* @return {object} A koa-router for accessing actions on the Dynamoose model
*/
module.exports = function (model, options) {
    let router = require('koa-router')();
    let name = model.$__.table.name.toLowerCase();

    let keys = util.getKeys(model, options);

    // Go through methods and create a route for each
    _.forOwn(methods, (m, method) => {
        if (options[method]) {
            // Merge global and local options into a single object
            let opts = util.mergeOptions(options[method], _.omit(options.globals, Object.getOwnPropertyNames(methods)));
            // Create middleware for jwt check and resource operation
            let middleware = [...createBeforeMiddleware(model, opts),
                m.factory(model, opts, keys)];
            // Path for the router
            let path = m.detailPath ? getPath(name, keys, opts) : '/';
            // Register route
            router[m.method || method].apply(router, [path, ...middleware]);
        }
    });
    return router;
};

function getPath(name, keys, options) {
    // TODO: no hash and no range key should not work
    let path = options.hashKey ? '' : ('/:' + name + '_hash');
    if (keys.rangeKey) {
        path += '/:' + name + '_range';
    }
    return path;
}

function createBeforeMiddleware(models, options) {
    let jwtOpt = util.getJwt(options.jwt);
    // Make sure a keys object exists in state
    let middleware = [async (ctx, next) => {
        ctx.state.keys = ctx.state.keys || {};
        await next();
    }];
    // The property jwt must be set to protect the method on the model.
    if (jwtOpt && jwtOpt.key) {
        middleware.push(jwt({ secret: jwtOpt.key, passthrough: jwtOpt.optional }));
    }
    // Check if user is allowed to perform operation/query
    if (options.authorize) {
        middleware.push(async (ctx, next) => {
            util.authorize(ctx, options.authorize);
            await next();
        });
    }
    return middleware;
}