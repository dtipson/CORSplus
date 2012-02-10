#CORSplus

###tiny library for handling CORS POST behavior, with a batching backup in case it's not supported.
-------------

Note that this is set up to work for a specific API, one that sets/gets particular counters or values based on short id strings. This entire approach is aimed at tasks that involve reading/updating massive numbers of unique ids stored on a resource that may live on a different domain from the client site.  It almost certainly won't be appropriate for your particular usage.  But the methods/apporach may be helpful.

Requirements: jQuery 1.6+, JSON (native or [polyfilled](https://github.com/douglascrockford/JSON-js))

Known limitations: 
-----------
*	release quality?  No. Will finish once I've run through testing all the methods now that it's been re-worked.
*	still fixing IE XDomain support method (was working before, needs to be refactored to current approach).
*	need to add result filter to all methods (mainly the IE method)
*	for backup method, the function doesn't currently check for ids/values that are too long, all by themselves, to fit into a single JSONP uri. These will fail, probably horribly. So stick to short keys/values that can at least fit into a single request.
*	every browser using the XDomainRequest method (all IEs prior to what's proposed for 10) has a number of additional, [annoying restrictions](http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx) that you need to consider (can only handle one sort of content-type from the server, must have the same scope as the server, etc.