const _ = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('../testutil');
const testModel = require('../testmodel.js');

const put = require('../../methods/put');
const AccessDeniedError = require('../../errors/AccessDeniedError');
const InternalServerError = require('../../errors/InternalServerError');
const ItemExistsError = require('../../errors/ItemExistsError');

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
    sinon.stub(testModel.model, 'create', function (data){
        return Promise.resolve(data);
    });
}

describe('dynarouter', function () {
    describe('put', function () {

        afterEach(function() {
            if (typeof testModel.model.create.restore === 'function')
                testModel.model.create.restore();
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
            expect(testModel.model.create.calledOnce).to.be.true;
        });

        it('should set hash to "test" before adding item to database', async function() {
            defaultStub();
            let middleware = createMiddleware({
                transform: (data, ctx) => Object.assign({}, data, {hash: 'test'})
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {hash: 'test'})
            });
            expect(testModel.model.create.firstCall.args[0].hash).to.equal('test');
        });

        it('should add a property "test" to the return value', async function() {
            defaultStub();
            let middleware = createMiddleware({
                after: (data, ctx) => Object.assign({}, data, {test: true})
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {test: true})
            });
            expect(testModel.model.create.firstCall.args[0].test).to.not.exist;
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(testModel.model, 'create').returns(Promise.reject(new Error()));
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });

        it('should throw an ItemExistsError', async function() {
            let error = new Error();
            error.name = 'ConditionalCheckFailedException';
            sinon.stub(testModel.model, 'create').returns(Promise.reject(error));
            
            let middleware = createMiddleware({
                overwrite: false
            });
            let ctx = createContext();
            ctx.request.body = testModel.object;
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(ItemExistsError);
        });
    });
});