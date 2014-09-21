/**
 * Sitespeed.io - How speedy is your site? (http://www.sitespeed.io)
 * Copyright (c) 2014, Peter Hedenskog, Tobias Lidskog
 * and other contributors
 * Released under the Apache 2.0 License
 */
var util = require('../../util');
var Aggregator = require('../../aggregator');

module.exports = new Aggregator('pageWeight',
  'Total page weight (including all assets)',
  'The total size is really important because of slow mobile networks, keep the size small.',
  'bytes', 2,
  function(pageData) {
    if (pageData.yslow) {
      this.stats.push(util.getSize(pageData.yslow.comps));
    }
  });