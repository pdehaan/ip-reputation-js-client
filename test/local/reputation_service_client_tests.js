/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var test = require('tap').test;
var IPReputationClient = require('../../lib/client');
var TIGERBLOOD_ADDR = process.env.TIGERBLOOD_ADDR;

var client = new IPReputationClient({
  serviceUrl: 'http://' + TIGERBLOOD_ADDR,
  id: 'root',
  key: 'toor',
  timeout: 50
});
var invalidIPError = new Error("Invalid IP.");

test(
  'throws exception when missing one or more required config param',
  function (t) {
    [
      {},
      {id: 'root', key: 'toor'},
      {serviceUrl: 'https://127.0.0.1:8080', id: 'root'},
      {serviceUrl: 'https://127.0.0.1:8080', key: 'toor'},
    ].forEach(function (badConfig) {
      t.throws(function () {
        return new IPReputationClient(badConfig);
      });
    });
    t.end();
  }
);

test(
  'throws exception for invalid serviceUrl scheme',
  function (t) {
    [
      {serviceUrl: 'gopher://127.0.0.1:8080', id: 'root', key: 'toor'}
    ].forEach(function (badConfig) {
      t.throws(function () {
        return new IPReputationClient(badConfig);
      });
    });
    t.end();
  }
);

test(
  'does not get reputation for a nonexistent IP',
  function (t) {
    client.get('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 404);
      t.end();
    });
  }
);

test(
  'does not update reputation for nonexistent IP',
  function (t) {
    client.update('127.0.0.1', 5).then(function (response) {
      t.equal(response.statusCode, 404);
      t.equal(response.body, undefined);
      t.end();
    });
  }
);

test(
  'does not remove reputation for a nonexistent IP',
  function (t) {
    client.remove('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 200);
      t.equal(response.body, undefined);
      t.end();
    });
  }
);

test(
  'does not get reputation for a invalid IP',
  function (t) {
    t.rejects(client.get('not-an-ip'), invalidIPError);
    t.end();
  }
);

test(
  'does not add reputation for a invalid IP',
  function (t) {
    t.rejects(client.add('not-an-ip', 50), invalidIPError);
    t.end();
  }
);

test(
  'does not update reputation for invalid IP',
  function (t) {
    t.rejects(client.update('not-an-ip', 5), invalidIPError);
    t.end();
  }
);

test(
  'does not remove reputation for a invalid IP',
  function (t) {
    t.rejects(client.remove('not-an-ip'), invalidIPError);
    t.end();
  }
);

test(
  'does not sendViolation for a invalid IP',
  function (t) {
    t.rejects(client.sendViolation('not-an-ip', 'test_violation'), invalidIPError);
    t.end();
  }
);

// the following tests need to run in order

test(
  'adds reputation for new IP',
  function (t) {
    client.add('127.0.0.1', 50).then(function (response) {
      t.equal(response.statusCode, 201);
      t.end();
    });
  }
);

test(
  'does not add reputation for existing IP',
  function (t) {
    client.add('127.0.0.1', 50).then(function (response) {
      t.equal(response.statusCode, 409);
      t.equal(response.body, 'Reputation is already set for that IP.');
      t.end();
    });
  }
);

test(
  'gets reputation for a existing IP',
  function (t) {
    client.get('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 200);
      t.deepEqual(response.body, {IP:'127.0.0.1', Reputation:50, Reviewed: false});
      t.end();
    });
  }
);

test(
  'updates reputation for existing IP',
  function (t) {
    client.update('127.0.0.1', 5).then(function (response) {
      t.equal(response.statusCode, 200);
      t.equal(response.body, undefined);
      t.end();
    });
  }
);

test(
  'removes reputation for existing IP',
  function (t) {
    client.remove('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 200);
      t.equal(response.body, undefined);
      return client.get('127.0.0.1'); // verify removed IP is actually gone
    }).then(function (response) {
      t.equal(response.statusCode, 404);
      t.equal(response.body, undefined); // JSON.stringify() -> undefined
      t.end();
    });
  }
);

test(
  'sends a violation',
  function (t) {
    client.get('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 404);
      return client.sendViolation('127.0.0.1', 'test_violation'); // need 'violation_penalties: test_violation=30' in tigerblood config.yml
    }).then(function (response) {
      t.equal(response.statusCode, 204);
      return client.get('127.0.0.1');
    }).then(function (response) {
      t.equal(response.statusCode, 200);
      t.deepEqual(response.body, {IP:'127.0.0.1', Reputation:70, Reviewed: false});
      t.end();
    });
  }
);

test(
  'cleans up inserted test reputation entry', // lets us run this multiple times without wiping the DB
  function (t) {
    client.remove('127.0.0.1').then(function (response) {
      t.equal(response.statusCode, 200);
      t.equal(response.body, undefined);
      t.end();
    });
  }
);

test(
  'times out a GET request',
  function (t) {
    var timeoutClient = new IPReputationClient({
      serviceUrl: 'http://10.0.0.0:8080/', // a non-routable host
      id: 'root',
      key: 'toor',
      timeout: 1 // ms
    });

    timeoutClient.get('127.0.0.1').then(function () {}, function (error) {
      t.notEqual(error.code, null);
      t.end();
    });
  }
);

test(
  'errors on invalid SSL cert',
  function (t) {
    var timeoutClient = new IPReputationClient({
      serviceUrl: 'https://expired.badssl.com/',
      id: 'root',
      key: 'toor',
      timeout: 1500 // ms
    });

    timeoutClient.get('127.0.0.1').then(function () {}, function (error) {
      t.equal(error.code, 'CERT_HAS_EXPIRED');
      t.end();
    });
  }
);
