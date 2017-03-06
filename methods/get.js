const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const NotFoundError = require('../errors/NotFoundError');
const util = require('../util');

function createMiddleware(model, options, keys) {
    let name = model.$__.table.name.toLowerCase();
    // middleware function
    return async (ctx, next) => {
        let result;

        let hashKey = await util.resolveFn(options.hashKey || ctx.params[name + '_hash'], ctx);
        // Prepare keys
        let params = {[keys.hashKey] : hashKey};
        if (keys.rangeKey) {
            params[keys.rangeKey] = ctx.params[name + '_range'];
        }
        ctx.state.keys[name] = params;

        let opts = {};
        // Attributes to load
        if (options.attributes) {
            opts.attributes = await util.resolveFn(options.attributes, ctx);
        }

        try {
            result = await util.execParallel(ctx, model.get(params, opts), options.parallel);
        } catch(e) {
            throw new InternalServerError('Resource could not be retrieved', e);
        }

        if (!result) throw new NotFoundError();

        // Check based on data if user is allowed to see it
        await util.postAuthorize(ctx, result, options);

        if (options.after) {
            result = await options.after(ctx, result);
        }
        
        ctx.body = {
            success: true,
            data : result
        };
    };
}

module.exports = function getMiddleware(model, options, keys) {
    var middleware = createMiddleware(model, options, keys);
    return async (ctx, next) => {
        await middleware(ctx, next);
    };
};