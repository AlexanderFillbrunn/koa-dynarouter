const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const ItemExistsError = require('../errors/ItemExistsError');

const util = require('../util');

function createMiddleware(model, options, keys) {
    let name = model.$__.table.name.toLowerCase();
    // middleware function
    return async (ctx, next) => {
        let data = ctx.request.body;
        let result;

        // Transform data
        if (options.transform) {
            data = await options.transform(ctx, data);
        }
        try {
            result = await util.execParallel(ctx,
                model.create(data, {overwrite : options.overwrite}),
                options.parallel);
        } catch(e) {
            if (e.name === 'ConditionalCheckFailedException') {
                throw new ItemExistsError();
            }
            throw new InternalServerError('Resource could not be created', e);
        }

        if (options.after) {
            let after = await options.after(ctx, result);
            if (typeof after !== 'undefined') {
                result = after;
            }
        }
        // Set status to "created"
        ctx.status = 201;
        // Done, set body to success message
        ctx.body = {
            success : true,
            data: result
        };
    };
}

module.exports = function postMiddleware(model, options, keys) {
    var middleware = createMiddleware(model, options, keys);
    return async (ctx, next) => {
        await middleware(ctx, next);
    };
};