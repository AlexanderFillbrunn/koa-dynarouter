const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const BadRequestError = require('../errors/BadRequestError');

const _ = require('lodash');
const util = require('../util');

function createMiddleware(model, options, keys) {
    let name = model.$__.table.name.toLowerCase();
    // middleware function
    return async (ctx, next) => {
        let data = ctx.request.body;
        let result;
        let query;
        let hashKeys = ctx.request.query['hashKeys'];
        let rangeKeys = ctx.request.query['rangeKeys'];

        if (!hashKeys && !rangeKeys) {
            // We simply use a Dynamoose query that the user provides
            if (options.query) {
                query = await util.resolveFn(options.query, model, ctx);
            } else {
                query = model.scan();
            }
        } else if (rangeKeys && !hashKeys) {
            // User has given us the ids to retrieve
            if (options.hashKey) {
                let hashKey = await util.resolveFn(options.hashKey, ctx);
                hashKeys = rangeKeys.map(() => hashKey);
            } else {
                throw new BadRequestError('An array of hash keys must be given');
            }
        }
        if (hashKeys && hashKeys.length > 100) {
            throw new BadRequestError('The number of keys to retrieve is limited to 100');
        }
        // Execute
        try {
            if (query) {
                // Query the table
                result = await util.execParallel(ctx, query.exec(), options.parallel);
            } else {
                // User has given IDs in the query parameters. We use them using batch get
                // Maximum number of items is 100
                let opts = {};
                // Attributes to load
                if (options.attributes) {
                    opts.attributes = await util.resolveFn(options.attributes, ctx);
                }
                // Keys to query
                let keyObj;
                if (rangeKeys) {
                    keyObj = _.zipWith(hashKeys, rangeKeys, (h, r) => {
                        return {[keys.hashKey]: h, [keys.rangeKey]: r};
                    });
                } else {
                    keyObj = hashKeys.map(h => {
                        return {[keys.hashKey]: h};
                    });
                }
                result = await util.execParallel(ctx, model.batchGet(keyObj, opts), options.parallel);
            }
        } catch(e) {
            throw new InternalServerError('Resources could not be retrieved', e);
        }

        // Check based on data if user is allowed to see result
        await util.postAuthorize(ctx, result, options);

        // Postprocessing
        let d = result;
        // Filter results
        if (options.filter) {
            d = d.filter((item, idx) => options.filter(item, idx, ctx));
        }
        // Transform items
        if (options.map) {
            d = d.map((item, idx) => options.map(item, idx, ctx));
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