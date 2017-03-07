# koa-dynarouter

koa-dynarouter builds koa routers based on [Dynamoose](https://github.com/automategreen/dynamoose) models, exposing methods like POST, GET, PUT, DELETE, and PATCH. This makes it pretty easy to quickly build an API backed by Amazon DynamoDB.

koa-dynarouter uses async/await and therefore either needs a transpiler like [Babel](https://babeljs.io) or node.js >= 7.6.

## Example

The Dynamoose model:

```javascript
var catSchema = new dynamoose.Schema({
  ownerId: {
      type: Number,
      hashKey: true
  },
  name: {
      type: String,
      rangeKey: true
  },
  color: String,
  age: Number
});

var Cat = dynamoose.model('Cat', catSchema);
```

The code for creating a router that allows every operation:

```javascript
const dynarouter = require('koa-dynarouter');

var router = dynarouter(Cat, {
    get: true,      // GET /:cat_hash/:cat_range
    query: true,    // GET /
    post: true,     // POST /
    put: true,      // PUT /:cat_hash/:cat_range
    del: true,      // DELETE /:cat_hash/:cat_range
    patch: true     // PATCH /:cat_hash/:cat_range
});
```
**Please note:** PUT does not check if the resource really has the correct id. This has to be done manually in the transform hook.

## Details

Instead of simply setting the method to true, you can pass an options object with hooks and settings. Hooks and settings can also
be defined on the top level of the settings object. They are then treated as defaults and are overwritten by properties in the settings for the individual methods.

### all methods

**authorize:**
A function returning a boolean or a promise for a boolean. If this evaluates to false, an AccessDeniedError is thrown. The function receives the koa context as an argument and can use that to access the URL parameters, which are the lowercase model name suffixed with either _hash or _range. Additionally those two parameters are stored in `ctx.state.keys.<modelname>.<propertyname>`.

**jwt:**
Settings to protect the endpoint by reading a JSON Web Token (e.g. generated with njwt). Has the form:
```javascript
jwt: {
    key: <yoursecretjwtkey>,
    optional: <boolean>
}
```
The key property is the key that is used to decode the token and optional indicates whether the endpoint can only be accessed when a JWT is provided.

**parallel operations:**
Sometimes certain operations should be run in parallel while the request to DynamoDB runs. When a property named "parallel" is present in the settings for a method, it is expected to consist of two parts:

- **actions:** a list of functions to execute in parallel
- **merge:**: a function merging the result from DynamoDB with those from the parallel actions.

A common use case is the retrieval of additional data from another source and joining the two records. The following example additionally loads a cat's owner information using the Dynamoose model "Owner" and appends it as property "owner" to the cat.

```javascript
var router = dynarouter(Cat, {
    get: {
        parallel: {
            actions: [
                (ctx) => Owner.get({id: ctx.params.cat_hash})
            ],
            merge: (ctx, getRes, pRes) => Object.assign(getRes, {owner: pRes[0]})
        }
    }
}
```

### get

```javascript
var router = dynarouter(Cat, {
    get: {
        // Only owner is allowed to see cat
        authorize: (ctx) => ctx.params.cat_hash === ctx.state.user.id,
        // The cat's hash key is retrieved from a dynarouter this router is nested in
        hashKey: (ctx) => ctx.params.owner_hash,
        // Only get two attributes
        attributes: ['name', 'color'],
        // Only admins are allowed to see pink cats
        postAuthorize: (ctx, cat) => cat.color !== 'pink' || ctx.state.user.isAdmin,
        // We only need a descriptive string, not the full data
        after: (ctx, cat) => `${cat.name} (${cat.color})`
    }
});
```

**hashKey:**
If the hash key should not be part of the URL, this setting indicates how the hashKey should be calculated instead. Can be either a function returning a value (or a promise resolving to it) or a simple value. When this property is set, the generated path is `/:<modelname>_range` instead of `/:<modelname>_hash/:<modelname>_range` and the hash key is calculated by the given function or set to the given value. Via the context object the function can access URL parameters from a router it is nested in to allow URLs like `/owners/5/cats/hugo`.  Here we could use `hashKey: (ctx) => ctx.params.owner_hash` to access the hash key of the owner, which is also the hash key of the cat.

**attributes:**
Either a function returning an array (or a promise resolving to an array) or a simple array of property names to return.

**postAuthorize:**
Like authorize, but as a second argument the retrieved data is available to the authorization function.

**after:**
A simple mapping function applied to the data. Can either return the transformed data directly or as a promise, which is resolved by koa-dynarouter. Has access to the koa context and the data.

### query

```javascript
var router = dynarouter(Cat, {
    query: {
        // Allowed for everyone. We could also simply omit this setting.
        authorize: (ctx) => true,
        // Only cats of current user are returned.
        // See https://github.com/automategreen/dynamoose
        query: (ctx, model) => model.query('ownerId').eq(ctx.state.user.id),
		// Here we could potentially inspect the list of cats
		// and decide if the user is allowed to see it.
        postAuthorize: (ctx, cats) => true,
        // Filter out cats with age > 10 (we could have done that in DynamoDB, too)
        filter: (ctx, cat) => cat.age <= 10,
        // Add a property indicating whether cat belongs to current user
        map: (ctx, cat) => Object.assign(cat,
					        {isOwnerOf: cat.ownerId === ctx.state.user.id})
    }
});
```

**query:**
A query or scan object retrieved from the Dynamoose model by calling `model.query(<hashkeyname>)`or `model.scan()` and appending the modifiers as described in the [Dynamoose documentation](https://github.com/automategreen/dynamoose).

**postAuthorize:**
Like authorize but also receives the data that was loaded from DynamoDB.

**filter:**
A function for filtering the result. Receives the koa context and an item as arguments and should return a boolean.

**map:**
A function mapping items. Receives the koa context and an item as arguments and should return a new item.

### post

```javascript
var router = dynarouter(Cat, {
    post: {
        // Only admins are allowed to create new cats
        authorize: (ctx) => ctx.state.user.isAdmin,
        // The cat's owner is the current user
        transform: (ctx, cat) => Object.assign(cat, {ownerId: ctx.state.user.id}),
        // Existing cat with same name and owner is overwritten (default: false)
        overwrite: true,
        // We only need the cat's name returned
        after: (ctx, cat) => cat.name,
    }
});
```

**transform:**
A simple mapping function applied to the item before it is inserted. Can either return the transformed item directly or as a promise, which is resolved by koa-dynarouter. Has access to the koa context and the data to be inserted.

**overwrite:**
A boolean indicating whether items with the same key should be overwritten. Defaults to false. If the item exists, an ItemExistsError is thrown.

**after:**
A simple mapping function applied to the inserted item. Can either return the transformed data directly or as a promise, which is resolved by koa-dynarouter. Has access to the koa context and the new item.

### put

```javascript
var router = dynarouter(Cat, {
    put: {
        // Only admins are allowed to create new cats
        authorize: (ctx) => ctx.state.user.isAdmin,
	    // The cat's hash key is retrieved from a dynarouter this router is nested in
        hashKey: (ctx) => ctx.params.owner_hash,
        // Make sure the cat has the properties which the URL indicates
        transform: (ctx, cat) =>
	        Object.assign(cat, {ownerId: parseInt(ctx.params.cat_hash),
						        name: ctx.params.cat_range}),
        // Existing cat with same name and owner is overwritten (default: false)
        overwrite: true,
        // We only need the cat's name returned
        after: (ctx, cat) => cat.name,
    }
});
```

See post for description of the settings.

### patch

```javascript
var router = dynarouter(Cat, {
    patch: {
        // Only admins are allowed to create new cats
        authorize: (ctx) => ctx.state.user.isAdmin,
	    // The cat's hash key is retrieved from a dynarouter this router is nested in
        hashKey: (ctx) => ctx.params.owner_hash,
        // Only allow the name to be changed
        allowedProperties: ['name'],
        // Alternatively: Forbid the ownerId and name to be changed
        forbiddenProperties: ['ownerId', 'name'],
        // Change the color to include the suffix " (changed)"
        transform: (ctx, cat) => Object.assign(cat,
							        {color: cat.color + ' (changed)'}),
        // We only need the cat's name. Otherwise all properties are returned.
        after: (ctx, cat) => cat.name
    }
});
```

**allowedProperties:**
Properties the user is allowed to change. Can be a function returning an array of property names or a promise for such, or a simple array of property names.

**forbiddenProperties:**
Like allowedProperties, just inverted.

See post, put and get for description of the other settings.

### del

```javascript
var router = dynarouter(Cat, {
    del: {
        // Only admins are allowed to create new cats
        authorize: (ctx) => ctx.state.user.isAdmin,
	    // The cat's hash key is retrieved from a dynarouter this router is nested in
        hashKey: (ctx) => ctx.params.owner_hash,
        // The operation fails if cat does not exist and it returns the deleted cat.
        // If false, only the deleted key is returned.
        update: true,
        // We only need the deleted cat's name. Otherwise all properties are returned.
        after: (ctx, cat) => cat.name
    }
});
```

**update:**
Whether this is an update or not. If true, the operation fails if the resource does not exist. Returns the deleted item if the operation succeeds. If set to false, only the item's key is returned.

See post, put and get for description of the other settings.

## TODOs

- [ ] Finish unit tests
- [ ] Batch putItem and deleteItem
- [ ] Support nested routers of the same model (currently parameter names clash)
- [ ] Example App
