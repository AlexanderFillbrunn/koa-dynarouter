const _ = require('lodash');
const dynamoose = require('dynamoose');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('./testutil');
const testModel = require('./testmodel.js');

const patch = require('../methods/patch');
const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');

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
    sinon.stub(dynamoose.ddb(), 'updateItem', function (params, callback){
        callback(null, {
            Attributes: Object.assign({}, testModel.getResponse.Item, {
                sProperty: {S: 'newvalue'}
            })
        });
    });
}

describe('dynarouter', function () {
    describe('patch', function () {

        afterEach(function() {
            if (typeof dynamoose.ddb().updateItem.restore === 'function')
                dynamoose.ddb().updateItem.restore();
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
                after: (ctx, data) => Object.assign({}, data, {test: true})
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

/*        it('should throw an AccessDeniedError before updateItem is called', async function() {
            defaultStub();
            
            let middleware = createMiddleware({
                preAuthorize: (ctx) => false
            });
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };

            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(()=>{
                expect(dynamoose.ddb().updateItem.called).to.be.false;
            });
        });*/

        it('should add an update to nProperty to the patch', async function() {
            sinon.stub(dynamoose.ddb(), 'updateItem', function (params, callback){
                callback(null, {
                    Attributes: Object.assign({}, testModel.getResponse.Item, {
                        sProperty: {S: 'newvalue'},
                        nProperty: {N: '5'}
                    })
                });
            });
            
            let middleware = createMiddleware({
                transform: (ctx, data) => Object.assign({}, data, {nProperty: 5})
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
            expect(dynamoose.ddb().updateItem.called).to.be.true;
        });

        it('should filter out the update for property "sProperty"', async function() {
            sinon.stub(dynamoose.ddb(), 'updateItem', function (params, callback){
                callback(null, {
                    Attributes: Object.assign({}, testModel.getResponse.Item, {nProperty: {N: '5'}})
                });
            });
            
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
            expect(dynamoose.ddb().updateItem.called).to.be.true;
        });

        it('should filter out the updates for all properties but the property "sProperty"', async function() {
            sinon.stub(dynamoose.ddb(), 'updateItem', function (params, callback){
                callback(null, {
                    Attributes: Object.assign({}, testModel.getResponse.Item, {sProperty: {S: 'newvalue'}})
                });
            });
            
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
            expect(dynamoose.ddb().updateItem.called).to.be.true;
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(dynamoose.ddb(), 'updateItem').callsArg(1).withArgs(new Error(), null);
            
            let middleware = createMiddleware({});
            let ctx = createContext();
            ctx.request.body = {
                sProperty: 'newvalue'
            };
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });
    });
});