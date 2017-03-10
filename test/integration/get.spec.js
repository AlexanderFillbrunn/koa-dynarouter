const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const router = require('koa-router');

const supertest = require('supertest');
const dynamoose = require('dynamoose');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const dynarouter = '../../index';

const testModel = require('../testModel.js');

const app = new Koa();
app.use(bodyParser());

describe('dynarouter', function () {
    describe('get', function () {
        const server;
        const request;

        before(function() {
            let app = new Koa();
            let mainRouter = router();

            let dr = dynarouter(testModel.model, {
                get: true,
                query: true,
                post: true,
                put: true,
                patch: true,
                del: true
            });

            app.use(mainRouter.routes()).use(mainRouter.allowedMethods());
            server = app.listen();
            request = supertest(server);
        });

        after(function() {
            server.close();
        });

        it('should return a test model object');
    });
});