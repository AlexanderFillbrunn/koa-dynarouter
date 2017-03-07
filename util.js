const _ = require('lodash');
const AccessDeniedError = require('./errors/AccessDeniedError');

/**
 * Merges local and global JWT settings
* @function mergeJwt
* @param  {object} local  local settings
* @param  {object} global global settings
* @return {object} merged settings
*/
function mergeJwt(local, global) {
    if (!local && !global) return undefined;
    if (!local) return global;
    if (!global) return local;
    return {
        key: local.key || global.key,
        optional: (typeof local.optional == 'undefined') ? global.optional : local.optional
    };
}

/**
 * Creates an internal JWT settings object
* @function getJwt
* @param  {(object|string)} o the user setting to transform.
                            If it is a string, it is treated as a key and JWT is not optional.
* @param  {string} [o.key] the jwt key
* @param  {boolean} [o.optional] if true the JWT is optional for the operation
* @return {object} an JWT settings object
*/
function getJwt(o) {
    if (o) {
        if (typeof o === 'string')
            return {key: o};
        else
            return _.pick(o, ['key', 'optional']);
    } else {
        return {};
    }
}

/**
* When passed a function, calls it with other arguments, else returns the object.
* Promises are resolved automatically.
* @function resolveFn
* @param  {(object|function)} o The function or object to resolve
* @return {any} The object or the result of calling the function
*/
async function resolveFn(o) {
    if (typeof o !== 'function')
        return o;
    var args = Array.prototype.slice.call(arguments, 1);
    return await o.apply(null, args);
}

/**
 * Retrieves hash and range key from a model or index.
* @function getKeys
* @param  {object} model   The model to retrieve the hash and range key from.
* @param  {object} options The options used for building the router. If a property "gsi" is present and a string,
                            hash and range key of that index are retrieved.
* @return {object} An object with properties hashKey and rangeKey, containing the respective property name
*/
function getKeys(model, options) {
    let keys = {};
    // If this is for an index, use it
    if (options.gsi && typeof options.gsi === 'string') {
        let index = model.$__.schema.indexes.global[options.gsi];
        // TODO: Maybe hashKey must be set to the index name (dynamoose/lib/Query.js:85)
        keys.hashKey = index.name;
        if (index.indexes[options.gsi].rangeKey) {
            keys.rangeKey = index.indexes[options.gsi].rangeKey;
        }
    } else {
        keys.hashKey = model.$__.schema.hashKey.name;
        if (model.$__.schema.rangeKey) {
            keys.rangeKey = model.$__.schema.rangeKey.name;
        }
    }
    return keys;
}

/**
 * Merges local and global options for methods
* @function mergeOptions
* @param  {object} local  Local options
* @param  {object} global Global options
* @return {object} Merged options
*/
function mergeOptions(local, global) {
    return Object.assign({}, global, local,
            {jwt: mergeJwt(local.jwt, global ? global.jwt : null)});
}

/**
 * Asynchronously executes an action and, if present, other actions in parallel and merges their results.
* @function execParallel
* @param  {type} ctx      the koa context
* @param  {function} action   the main action
* @param  {object} [parallel] an object containing the information for parallel actions
* @param  {function[]} [parallel.actions]   the actions to execute in parallel
* @param  {function} [parallel.merge]   the function to merge the results
* @return {any} the result of the merge operation or of the main action if no parallel actions are given
*/
async function execParallel(ctx, action, parallel) {
    let actions = [action];
    if (parallel) {
        actions = [...actions, ...parallel.actions.map(a => a(ctx))];
    }
    let results = await Promise.all(actions);
    return parallel ? parallel.merge(ctx, results) : results[0];
}

function handleAuthorize(auth) {
    if (!auth) throw new AccessDeniedError();
    else if (auth instanceof Error) {
        throw new AccessDeniedError(auth.message, auth);
    } else if (typeof auth === 'object' && !auth.pass) {
        throw new AccessDeniedError(auth.message);
    }
}

/**
 * Authorizes a user based on the koa context.
 * Throws an AccessDeniedError when function returns false,
 * an error or a special object.
* @function handleAuthorize
* @param  {object} ctx the koa context
* @param  {function} authorize the user-defined function to use.
* @return {undefined}
*/
async function authorize(ctx, authorizeFn) {
    let auth = await authorizeFn(ctx);
    handleAuthorize(auth);
}

/**
 * Authorizes a user based on the koa context and some data.
 * Throws an AccessDeniedError when function returns false,
 * an error or a special object.
* @function postAuthorize
* @param  {object} ctx the koa context
* @param  {any} data    the data
* @param  {object} options the options object to check for a postAuthorize property
* @return {undefined}
*/
async function postAuthorize(ctx, data, options) {
    if (options.postAuthorize) {
        let auth = await options.postAuthorize(ctx, data);
        handleAuthorize(auth);
    }
}

/**
 * Applies a mapping function to either the object itself or,
 * if it contains DynamoDB updates to properties, to the individual updates ($PUT, $ADD, $DELETE).
* @function applyProps
* @param  {object} d  The update object
* @param  {function} fn The mapping function
* @return {object} The transformed object
*/
function applyProps(d, fn) {
    if (d.$PUT || d.$ADD || d.$DELETE) {
        d = _.pick(d, '$PUT', '$DELETE', '$ADD');
        _.forOwn(d, (v, k) => d[k] = fn(v));
        return d;
    } else {
        return fn(d);
    }
}

module.exports = {
    getJwt: getJwt,
    resolveFn: resolveFn,
    getKeys: getKeys,
    mergeOptions: mergeOptions,
    execParallel: execParallel,
    authorize: authorize,
    postAuthorize: postAuthorize,
    applyProps: applyProps
};