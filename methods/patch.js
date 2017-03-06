const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const NotFoundError = require('../errors/NotFoundError');
const util = require('../util');
const _ = require('lodash');

function createMiddleware(model, options, keys) {
    let name = model.$__.table.name.toLowerCase();
    // middleware function
    return async (ctx, next) => {
        let data = ctx.request.body;
        let result;
        
        let hashKey = await util.resolveFn(options.hashKey || ctx.params[name + '_hash'], ctx);
        // Prepare keys
        let params = {[keys.hashKey] : hashKey};
        if (keys.rangeKey) {
            params[keys.rangeKey] = ctx.params[name + '_range'];
        }
        ctx.state.keys[name] = params;

        // Transform patch
        let d = options.transform ? await options.transform(ctx, data) : data;

        // Filter properties based on whitelist or blacklist
        if (options.allowedProperties) {
            let allowedProperties = await util.resolveFn(options.allowedProperties, ctx);
            d = util.applyProps(d, (d) => _.pick(d, allowedProperties));
        }
        if (options.forbiddenProperties) {
            let forbiddenProperties = await util.resolveFn(options.forbiddenProperties, ctx);
            d = util.applyProps(d, (d) => _.omit(d, forbiddenProperties));
        }

        // Perform DB update
        try {
            result = await util.execParallel(ctx, model.update(params, data), options.parallel);
        } catch(e) {
            throw new InternalServerError('Resource could not be updated', e);
        }

        if (options.after) {
            let after = await options.after(ctx, result);
            if (typeof after !== 'undefined') {
                result = after;
            }
        }

        // Set response
        ctx.body = {
            success: true,
            data: result
        };
    };
}

module.exports = function patchMiddleware(model, options, keys) {
    var middleware = createMiddleware(model, options, keys);
    return async (ctx, next) => {
        await middleware(ctx, next);
    };
};