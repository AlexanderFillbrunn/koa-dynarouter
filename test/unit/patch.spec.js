const _ = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('../testutil');
const testModel = require('../testmodel.js');

const patch = require('../../methods/patch');
const AccessDeniedError = require('../../errors/AccessDeniedError');
const InternalServerError = require('../../errors/InternalServerError');

chai.use(chaiAsPromised);
const expect = chai.expect;

function createContext() {
    return {
        request: {},
        params: {
            test_range: testModel.object.range,
            test_hash: testModel.object.hash
        },
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
    return patch(testModel.model, options, KEYS);
}

function defaultStub() {

    sinon.stub(testModel.model, 'update', function(id, updates) {
        return Promise.resolve(Object.assign({}, testModel.object, updates.$PUT || updates));
    });
}

describe('dynarouter', function () {
    describe('patch', function () {

        afterEach(function() {
            if (typeof testModel.model.update.restore === 'function')
                testModel.model.update.restore();
        });

        it('should call updateItem and return the item that was updated', async function() {
            defaultStub();
            
            let middleware = createMiddleware({});
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, ctx.request.body)
            });
        });

        it('should return the updated item with an added property "test"', async function() {
             defaultStub();
            
            let middleware = createMiddleware({
                after: (data, ctx) => Object.assign({}, data, {test: true})
            });
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, ctx.request.body, {test: true})
            });
        });

        it('should add an update to nProperty to the patch', async function() {
            defaultStub();
            
            let middleware = createMiddleware({
                transform: (data, ctx) => Object.assign({}, data, {nProperty: 5})
            });
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };
            await middleware(ctx, () => {});

            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, ctx.request.body, {nProperty: 5})
            });
        });

        it('should filter out the update for property "sProperty"', async function() {
            defaultStub();
            
            let middleware = createMiddleware({
                forbiddenProperties: ['sProperty']
            });
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue',
                nProperty: 5
            };
            await middleware(ctx, () => {});

            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, _.omit(ctx.request.body, 'sProperty'))
            });
        });

        it('should filter out the updates for all properties but the property "sProperty"', async function() {
            defaultStub();
            
            let middleware = createMiddleware({
                allowedProperties: ['sProperty']
            });
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue',
                nProperty: 5
            };
            await middleware(ctx, () => {});

            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, _.pick(ctx.request.body, 'sProperty'))
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(testModel.model, 'update').returns(Promise.reject(new Error()));
            
            let middleware = createMiddleware({});
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });
    });
});