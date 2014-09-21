/**
 * Sitespeed.io - How speedy is your site? (http://www.sitespeed.io)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */

var util = require('../util'),
  fs = require('fs-extra'),
  spawn = require('cross-spawn'),
  path = require('path'),
  log = require('winston'),
  async = require('async');

module.exports = {
  analyze: function(urls, config, asyncDoneCallback) {

    var browsers = config.browsertime;

    var mkdirFunctions = [];
    browsers.forEach(function(browser) {
      mkdirFunctions.push(
        function(callback) {
          fs.mkdirs(path.join(config.run.absResultDir, config.dataDir, 'browsertime', browser), function(err) {
            if (err) {
              throw err;
            }
            else {
              callback();
            }
          });
        }
      );
      mkdirFunctions.push(
        function(callback) {
          fs.mkdirs(path.join(config.run.absResultDir, config.dataDir, 'har', browser), function(err) {
            if (err) {
              throw err;
            }
            else {
              callback();
            }
          });
        }
      );
    });

    async.parallel(mkdirFunctions,
      function(err, results) {
        var queue = async.queue(runBrowsertime, 1);
        var errors = {};
        var pageData = {};

        urls.forEach(function(u) {
          browsers.forEach(function(browser) {
            log.log('info', 'Queueing browsertime for ' + u + ' ' + browser);
            queue.push({
              'url': u,
              'browser': browser,
              'config': config
            }, function(data, code) {
              if (code) {
                log.log('error', 'Error running browsertime: ' + code);
                errors[u] = code;
              } else {
                if (pageData[u]) {
                  pageData[u].push(data);
                }
                else {
                pageData[u] = [data];
                }
              }
            });
          });
        });

        queue.drain = function() {
          asyncDoneCallback(undefined, {
            'type': 'browsertime',
            'data': pageData,
            'errors': errors
          });
        };
      });
  }
};

function runBrowsertime(args, callback) {

  var url = args.url;
  var browser = args.browser;
  var config = args.config;

  log.log('info', 'Running browsertime for ' + browser + ' ' + url);

  var jsonPath = path.join(config.run.absResultDir, config.dataDir, 'browsertime', browser,
    util.getFileName(url) + '-browsertime.json');

  var harPath = path.join(config.run.absResultDir, config.dataDir, 'har', browser,
    util.getFileName(url) + '.har');

  var childArgs = [];
  childArgs.push('-Xmx' + config.memory + 'm', '-Xms' + config.memory + 'm');
  childArgs.push('-jar');
  childArgs.push(path.join(__dirname, '../browsertime-0.7-SNAPSHOT-full.jar'));
  childArgs.push('--raw');
  childArgs.push('-f', 'json');
  childArgs.push('-o', jsonPath);
  childArgs.push('-b', browser);
  childArgs.push('-n', config.no);
  childArgs.push('-ua', config.userAgent);
  childArgs.push('-w', config.viewPort);

  // add extra request headers
  if (config.requestHeaders) {
    var requestHeaders = '';
    Object.keys(config.requestHeaders).forEach(function (key) {
      requestHeaders += key + ':' + config.requestHeaders[key] + ',';
    });

    childArgs.push('--headers',requestHeaders);
  }

  if (config.proxy) {
    childArgs.push('-p', config.urlProxyObject.hostname + ':' + config.urlProxyObject
      .port);
    }
  if (config.basicAuth) {
    childArgs.push('--basic-auth', config.basicAuth);
  }

  childArgs.push('--har-file', harPath);

  childArgs.push(url);

  var bt = spawn('java', childArgs);

  bt.stdout.on('data', function(data) {
     //console.log('stdout:' + data);
  });

  bt.stderr.on('data', function(data) {
    // argh the BMP logs a lot on error
     // console.log('Error from BrowserTime: ' + data);
  });

  bt.on('close', function(code) {
    if (bt.exitCode!==0) {
      callback(undefined, 'Could not fetch data using BrowserTime, exit code ' + bt.exitCode!==0);
      return;
    }
    // TODO check code
    fs.readFile(jsonPath, function(err, btData) {
      if (err) {
        log.log('error', 'Couldnt read the file:' + jsonPath);
        callback(undefined, err);
      } else {
        fs.readFile(harPath, function(err, harData) {
          if (err) {
            log.log('error', 'Couldnt read the file:' + harPath);
            callback(undefined, err);
          } else {
        callback({'browser': browser, 'browsertime': JSON.parse(btData), 'har': JSON.parse(harData)}, undefined);
        }
      });
      }
    });
  });
}