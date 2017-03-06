const _ = require('lodash');
const dynamoose = require('dynamoose');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('./testutil');
const testModel = require('./testmodel.js');

const put = require('../methods/put');
const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const ItemExistsError = require('../errors/ItemExistsError');

chai.use(chaiAsPromised);
const expect = chai.expect;

function createContext() {
    return {
        request: {},
        params: {},
        state: {
            keys: {}
        }
    };
}

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createMiddleware(options) {
    return put(testModel.model, options, KEYS);
}

function defaultStub() {
    sinon.stub(dynamoose.ddb(), 'putItem', function (params, callback){
        callback(null, {
            Attributes: params.Item
        });
    });
}

describe('dynarouter', function () {
    describe('put', function () {

        afterEach(function() {
            if (typeof dynamoose.ddb().putItem.restore === 'function')
                dynamoose.ddb().putItem.restore();
        });

        it('should return the item that was added to the database and call putItem', async function() {
            defaultStub();
            let middleware = createMiddleware({});
            let ctx = createContext();
            ctx.request.body = testModel.object;
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: testModel.object
            });
            expect(dynamoose.ddb().putItem.called).to.be.true;
        });

        it('should set hash to "test" before adding item to database', async function() {
            defaultStub();
            let middleware = createMiddleware({
                transform: (ctx, data) => Object.assign({}, data, {hash: 'test'})
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {hash: 'test'})
            });
            expect(dynamoose.ddb().putItem.firstCall.args[0].Item.hash.S).to.equal('test');
        });

        it('should add a property "test" to the return value', async function() {
            defaultStub();
            let middleware = createMiddleware({
                after: (ctx, data) => Object.assign({}, data, {test: true})
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {test: true})
            });
            expect(dynamoose.ddb().putItem.firstCall.args[0].Item.test).to.not.exist;
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(dynamoose.ddb(), 'putItem').callsArg(1).withArgs(new Error(), null);
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });

        it('should throw an ItemExistsError', async function() {
            sinon.stub(dynamoose.ddb(), 'putItem', function(param, cb) {
                let error = new Error();
                error.name = 'ConditionalCheckFailedException';
                cb(error);
            });
            
            let middleware = createMiddleware({
                overwrite: false
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(ItemExistsError);
        });
    });
});