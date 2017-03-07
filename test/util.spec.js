const sinon = require('sinon');
const util = require('../util');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");

const testModel = require('./testmodel.js');

const AccessDeniedError = require('../errors/AccessDeniedError');

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('dynarouter', function () {
    describe('util', function () {
        describe('resolveFn', function () {
            it('should call the passed function and return its return value', async function() {
                let stub = sinon.stub().returns('test');
                await util.resolveFn(stub, 'arg');
                expect(stub.calledOnce).to.be.true;
                expect(stub.firstCall.args[0]).to.equal('arg');
                expect(stub.firstCall.returnValue).to.equal('test');
            });

            it('should return the passed object', async function() {
                expect(await util.resolveFn('test')).to.equal('test');
            });
        });
        describe('getKeys', function () {
            it('should return the model\'s hash and range key', function() {
                let keys = util.getKeys(testModel.model, {});
                expect(keys).to.have.property('hashKey');
                expect(keys).to.have.property('rangeKey');
                expect(keys.hashKey).to.equal('hash');
                expect(keys.rangeKey).to.equal('range');
            });

            it('should return the index\'s hash and range key', function() {
                let keys = util.getKeys(testModel.model, {
                    gsi: 'index'
                });
                expect(keys).to.have.property('hashKey');
                expect(keys).to.have.property('rangeKey');
                expect(keys.hashKey).to.equal('sProperty');
                expect(keys.rangeKey).to.equal('nProperty');
            });
        });

        describe('mergeOptions', function () {
            it('should overwrite the global options "b" property', function() {
                let merged = util.mergeOptions({b: '123'}, {a: 1, b: 'abc'});
                expect(merged.b).to.equal('123');
                expect(merged.jwt).to.be.undefined;
            });

            it('should overwrite the global jwt\'s overwrite property', function() {
                let merged = util.mergeOptions({jwt: {optional: true}}, {jwt: {key: 'abc', optional: false}});
                expect(merged).to.have.property('jwt');
                expect(merged.jwt.optional).to.be.true;
                expect(merged.jwt.key).to.equal('abc');
            });

            it('should return the global jwt', function() {
                let merged = util.mergeOptions({}, {jwt: {key: 'abc', optional: false}});
                expect(merged).to.have.property('jwt');
                expect(merged.jwt.optional).to.be.false;
                expect(merged.jwt.key).to.equal('abc');
            });

            it('should return the local jwt', function() {
                let merged = util.mergeOptions({jwt: {key: 'abc', optional: false}}, {});
                expect(merged).to.have.property('jwt');
                expect(merged.jwt.optional).to.be.false;
                expect(merged.jwt.key).to.equal('abc');
            });

            it('should return the local jwt with optional being true', function() {
                let merged = util.mergeOptions({jwt: {key: 'abc'}}, {jwt: {optional: true}});
                expect(merged).to.have.property('jwt');
                expect(merged.jwt.optional).to.be.true;
                expect(merged.jwt.key).to.equal('abc');
            });
        });

        describe('getJwt', function () {
            it('should return an object with key property', function() {
                let jwt = util.getJwt('mykey');
                expect(jwt).to.have.property('key').which.equals('mykey');
                expect(jwt.optional).to.be.not.ok;
            });

            it('should return an empty object', function() {
                let jwt = util.getJwt(undefined);
                expect(jwt).to.deep.equal({});
            });

            it('should return an object with key and optional properties', function() {
                let jwt = util.getJwt({key: 'abc', optional: true, something: 6});
                expect(jwt).to.deep.equal({key: 'abc', optional: true});
            });
        });

        describe('execParallel', async function() {
            let p = Promise.resolve('a');
            let parallel = {
                actions: [
                    (ctx) => 'b',
                    (ctx) => 'c'
                ],
                merge: (ctx, res) => {
                    return res.sort().join();
                }
            };
            let res = await util.execParallel({}, p, parallel);
            expect(res).to.equal('a,b,c');
        });

        describe('authorize', function () {
            it('should throw an AccessDeniedError', async function() {
                let spy = sinon.spy(function(ctx) {
                    return Promise.resolve(false);
                });
                return expect(util.authorize('ctx', spy)).to.eventually.be.rejectedWith(AccessDeniedError)
                .then(() => {
                    expect(spy.calledOnce).to.be.true;
                    expect(spy.firstCall.args[0]).to.equal('ctx');
                });
            });

            it('should throw an AccessDeniedError', async function() {
                let spy = sinon.spy(function(ctx) {
                    return new Error('test');
                });
                return expect(util.authorize('ctx', spy)).to.eventually.be.rejectedWith(AccessDeniedError)
                .then(() => {
                    expect(spy.calledOnce).to.be.true;
                    expect(spy.firstCall.args[0]).to.equal('ctx');
                });
            });

            it('should throw an AccessDeniedError with an error message', async function() {
                let spy = sinon.spy(function(ctx) {
                    return {
                        pass: false,
                        message: 'test'
                    };
                });
                return expect(util.authorize('ctx', spy)).to.eventually.be.rejectedWith(AccessDeniedError)
                .then(() => {
                    // TODO: How to check error message?
                    expect(spy.calledOnce).to.be.true;
                    expect(spy.firstCall.args[0]).to.equal('ctx');
                });
            });
        });

        describe('applyProps', function () {
            it('should apply the function to the object', function() {
                let obj = {
                    a: 1,
                    b: 2
                };
                let res = util.applyProps(obj, d => Object.assign({}, d, {c: 3}));
                expect(res).to.have.property('c').which.is.equal(3);
            });

            it('should apply the function to the $PUT, $ADD and $DELETE properties of the object', function() {
                let obj = {
                    $PUT: { a: 1 },
                    $ADD: { b: 2 },
                    $DELETE: { c: 3 }
                };
                
                let res = util.applyProps(obj, d => Object.assign({}, d, {e: 4}));
                expect(res.$PUT).to.have.property('e').which.is.equal(4);
                expect(res.$ADD).to.have.property('e').which.is.equal(4);
                expect(res.$DELETE).to.have.property('e').which.is.equal(4);
            });
        });
    });
});