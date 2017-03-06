const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const util = require('../util');

function createMiddleware(model, options, keys) {
    let name = model.$__.table.name.toLowerCase();
    // middleware function
    return async (ctx, next) => {
        let data = ctx.request.body;
        let result;
        let query;

        // We simply use a Dynamoose query that the user provides
        if (options.query) {
            query = await util.resolveFn(options.query, ctx, model);
        } else {
            query = model.scan();
        }

        // Execute
        try {
            result = await util.execParallel(ctx, query.exec(), options.parallel);
        } catch(e) {
            throw new InternalServerError('Resources could not be retrieved', e);
        }

        // Check based on data if user is allowed to see result
        await util.postAuthorize(ctx, result, options);

        // Postprocessing
        let d = result;
        // Filter results
        if (options.filter) {
            d = d.filter(item => options.filter(ctx, item));
        }
        // Transform items
        if (options.map) {
            d = d.map(item => options.map(ctx, item));
        }

        // Set body to result
        ctx.body = {
            success: true,
            lastKey : result.lastKey,
            data : d
        };
    };
}

module.exports = function queryMiddleware(model, options, keys) {
    var middleware = createMiddleware(model, options, keys);
    return async (ctx, next) => {
        await middleware(ctx, next);
    };
};