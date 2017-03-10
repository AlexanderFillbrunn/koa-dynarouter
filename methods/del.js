const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
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

        // If the update flag is true, pass it to dynamoose.
        // It requires the resource to exist and outputs all old attributes.
        let opts = {};
        if (options.update) {
            opts.update = await util.resolveFn(options.update, ctx);
        }

        try {
            result = await util.execParallel(ctx, model.delete(params, opts), options.parallel);
        } catch(e) {
            throw new InternalServerError('Resource could not be deleted');
        }

        if (options.after) {
            let after = await options.after(result, ctx);
            if (typeof after !== 'undefined') {
                result = after;
            }
        }

        ctx.body = {
            success: true,
            data: result
        };
    };
}

module.exports = function delMiddleware(model, options, keys) {
    var middleware = createMiddleware(model, options, keys);
    return async (ctx, next) => {
        await middleware(ctx, next);
    };
};