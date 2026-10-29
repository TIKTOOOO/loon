/* twitter_noads v1.0.0 — TIKTOOOO, 2026-10-29.
 * Original implementation. Local JSON filtering only; no network/storage/logging.
 * Remove explicitly promoted timeline entries; preserve unrelated content/cursors.
 */
(function () {
  'use strict';
  var result = {};
  try {
    var url = typeof $request === 'object' ? $request.url : '';
    var guard = /^https:\/\/(?:api\.)?(?:twitter|x)\.com\/(?:i\/api\/)?(?:graphql\/[^/?]+\/(?:HomeTimeline|HomeLatestTimeline|TweetDetail|TweetDetailWithInjections|SearchTimeline|UserTweets|UserTweetsAndReplies|UserMedia|ListLatestTweetsTimeline|Bookmarks|ExploreTimeline)(?:\?|$)|2\/timeline\/(?:home|profile|conversation\/[^/?]+)\.json(?:\?|$))/i;
    var status = typeof $response === 'object' ? Number($response.status) : 0;
    if (guard.test(url) && status === 200 && typeof $response.body === 'string') {
      var data = JSON.parse($response.body);
      var removed = 0;
      var visited = 0;
      function object(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
      function mark(x) {
        return object(x) && ((x.promotedMetadata !== undefined && x.promotedMetadata !== null && x.promotedMetadata !== false) ||
          (x.promoted_metadata !== undefined && x.promoted_metadata !== null && x.promoted_metadata !== false));
      }
      function advertised(x) {
        if (!object(x)) return false;
        var id = x.entryId || x.entry_id || '';
        if (/^promoted(?:[-_]|Tweet|Trend|User|Account)/.test(id)) return true;
        var c = x.content;
        var i = x.item;
        // Only known timeline wrappers; never inspect quoted tweets or text for keywords.
        return mark(x) || mark(x.itemContent) || mark(c) || mark(c && c.itemContent) ||
          mark(i) || mark(i && i.itemContent) ||
          mark(c && c.item && c.item.content && c.item.content.tweet);
      }
      function emptyChangedModule(entry, previousItems) {
        return previousItems > 0 && object(entry) && object(entry.content) &&
          Array.isArray(entry.content.items) && entry.content.items.length === 0;
      }
      function walk(node, depth) {
        if (++visited > 100000 || depth > 100) throw new Error('Limit');
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(function (item) { walk(item, depth + 1); });
          return;
        }
        Object.keys(node).forEach(function (key) {
          var value = node[key];
          if (Array.isArray(value) && /^(entries|items|moduleItems)$/.test(key)) {
            node[key] = value.filter(function (item) {
              if (advertised(item)) { removed++; return false; }
              var oldItems = object(item) && object(item.content) && Array.isArray(item.content.items) ? item.content.items.length : 0;
              walk(item, depth + 1);
              if (emptyChangedModule(item, oldItems)) { removed++; return false; }
              return true;
            });
          } else if ((key === 'entry' || key === 'replaceEntry') && advertised(value)) {
            // Do not delete an instruction's required entry: leave unfamiliar replacement forms alone.
            return;
          } else {
            walk(value, depth + 1);
          }
        });
      }
      walk(data, 0);
      if (removed > 0) result = { body: JSON.stringify(data) };
    }
  } catch (_) {
    // Parse errors, changed formats, or excessive nesting: preserve the original response.
    result = {};
  }
  $done(result);
})();
