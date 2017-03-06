const sinon = require('sinon');
const util = require('../util');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");

const testModel = require('./testmodel.js');

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

        describe('execParallel', function () {
            
        });

        describe('authorize', function () {

        });

        describe('postAuthorize', function () {

        });
    });
});