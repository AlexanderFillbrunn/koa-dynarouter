const get = require('../../methods/get');
const chai = require('chai');
const sinon = require('sinon');
const _ = require('lodash');
const AccessDeniedError = require('../../errors/AccessDeniedError');
const InternalServerError = require('../../errors/InternalServerError');
const NotFoundError = require('../../errors/NotFoundError');
const chaiAsPromised = require("chai-as-promised");
const tu = require('../testutil');

chai.use(chaiAsPromised);
const expect = chai.expect;

const testModel = require('../testmodel.js');

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createContext() {
    return {
        params: {
            test_range: testModel.object.range,
            test_hash: testModel.object.hash
        },
        state: {
            keys: {}
        }
    };
}

function createMiddleware(options) {
    return get(testModel.model, options, KEYS);
}

function defaultStub() {
    sinon.stub(testModel.model, 'get', function(id, opt) {
        let res = Object.assign({}, testModel.object);
        if (opt.attributes) {
            res = _.pick(res, opt.attributes);
        }
        return Promise.resolve(new testModel.model(res));
    });
}

describe('dynarouter', function () {
    describe('get', function () {
        afterEach(function() {
            if (typeof testModel.model.get.restore === 'function')
                testModel.model.get.restore();
        });

        it('should respond with an item instance', async function() {
            defaultStub();
            let middleware = createMiddleware({});
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(ctx.body).to.deep.equal({
                success: true,
                data: new testModel.model(testModel.object)
            });
        });

        it('should respond with an item instance without the sProperty', async function() {
            defaultStub();
            let attr = ['hash', 'range', 'nProperty'];
            let middleware = createMiddleware({
                attributes: attr
            });

            let ctx = createContext();
            await middleware(ctx, () => {});

            expect(ctx.body).to.deep.equal({
                success: true,
                data: new testModel.model(_.pick(testModel.object, attr))
            });
        });

        it('should respond with an item instance where a property "a" is added', async function() {
            defaultStub();
            let middleware = createMiddleware({
                after: (data, ctx) => Object.assign({}, data, {a: true})
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(ctx.body.data).to.have.property('a').which.is.true;
        });

        it('should throw an AccessDeniedError after getItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (data, ctx) => false
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(() => {
                expect(testModel.model.get.called).to.be.true;
            });
        });

        it('should not throw an AccessDeniedError after getItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (data, ctx) => true
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.not.be.rejectedWith(AccessDeniedError).then(() => {
                expect(testModel.model.get.called).to.be.true;
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(testModel.model, 'get').returns(Promise.reject(new Error()));
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });

        it('should throw a NotFoundError', async function() {
            sinon.stub(testModel.model, 'get').returns(Promise.resolve(void 0));
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(NotFoundError);
        });
    });
});
