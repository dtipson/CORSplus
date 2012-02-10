#CORSplus

##tiny library for handling CORS POST behavior, with a batching backup in case it's not supported.

Note that this is set up to work for a specific API, one that sets/gets particular counters or values based on short id strings.  There are a number of possible failure points for the backup method (for instance, a value being set is too long for a single request).  

This entire approach is aimed at tasks that involve reading/updating massive numbers of unique ids stored on a resource that may live on a different domain from the client site.  It almost certainly won't be appropriate for your particular usage.  But the methods/apporach may be helpful.

Requirements: jQuery 1.6+, JSON (native or polyfilled)

Known limitations: 
*	still fixing IE XDomain support (was working before, needs to be refactored to current approach).
*	doesn't currently check for ids/values that are too long, all by themselves, to fit into a single JSONP uri
*	every browser using the XDomainRequest method (all IEs prior to what's proposed for 10) has a number of additional, annoying restrictions: http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx