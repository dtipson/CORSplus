/*
  This is an API for accessing/changing counters or values.  It requires jQuery 1.6 or above and JSON.parse/stringify methods to already exist in order to not cause horrible errors
  
  basic usage:
  
  hashC.methodname(['an','array','of','keys']).then(function(d){  
    //behavior on success, d is an object containg the k/v pairs of either counters or values
  },function(e){  
    //this is entirely optional: what to do if the request fails, if anything. e may contain an error message at e.error if the API is still responding: 200 responses with 'error' will still fail properly. If only care about success, use .done() instead
  });
  
  Core methods:
    hashC.counters: takes any array of counter keys and returns the corresponding counter values
    hashC.values: takes an array of value keys and returns the corresponding values (can be stringified JSON)
    hashC.priCounters/priValues: same behavior, only will attempt a read of private counters or values instead
    
    note that counter ids are an array of strings that can, optionally, have assignments like =+1 or = newvalue
    So, ['a','b','c=+1','d'] will return the counter values of a, b, c, and d, with just the c value having been incremented by one
  
  Underlying Logic of the whole shebang: any of the core methods will first try to do a full-on CORS POST.  If that method doesn't work, they will instead attempt to use a single jsonp request.  If THAT request is too large, it will finally batch the jsonp calls into several calls and then combine the final result into a single return value that will act as if the orignal CORS POST succeeded, and returned a single result
  
*/
 
(function($){

	var hcUrl = '//your.domain.com/', //your CORS-y API resource goes here
		maxUrlLength = 2000,  //2000 characters is probably safe enough to fit into a single GET url. set this much, much lower to force it to batch things for testing purposes. But not too low, certainly not below 50, because then NO url path will ever be small enough, and things will explode
		
	hashC ={
		timeout: 10000, //not currently used anywhere, so, this is just extra bytes that are RUINING your day
		cors: $.support.cors, //just so we know from the start if the client can do CORS in the first place. You could also use Modernizr's CORS test here if you want, but everything else requires jQuery to work, so...
		buildQS: function (q,postm){
			q.ids = q.ids||[]; //if no ids were passed, please don't cause an error, ok? Just query the API pointlessly, and get back its pointless empty result
			
			/*now, let's build a standard query from the paramaters we got*/
			
			return hcURL+((q.v)?"values/":"counters/") //basically, is this a list of counters (key/numbers) or a list of values (key/string values)?
			+ ((q.p)?"private":"") //the API I'm basing this on uses a different path for private data, so here's the option for that
			+ ((!postm)?"/"+q.ids.join("|"):"")  //if this is a get request, we'll need to put the data directly into the url 
			+ ((!!q.i && !q.v) ? "/increment" : ""); //again, the API in question has an increment method for single values, so this... is for that
		},
		counters: function(ids){  //counters are numerical: the ids/keys match numbers
			return this.xpost({'ids':ids});
		},
		values: function(ids){  //values are ids/keys that match strings
			return this.xpost({'ids':ids,'v':true});          
		},
		priCounters: function(ids){  //if there is a private path (authenticated in some way by the server)
			return this.xpost({'ids':ids,p:true});          
		},
		priValues: function(ids){ //same as above, but for values
			return this.xpost({'ids':ids,'v':true,p:true});          
		},
		xpost: function (q) { //the master wrapping function, handles CORS request via a Deferred, or else falls back to a JSONP (possibly batched) request
			var xdr = $.Deferred(),  //master Deferred declared
				msdf, //a variable for holding the weirdo IE request
				url = this.buildQS(q,true), //let's convert the original function call's parameters into a standard query format
				data = {'ids': q.ids.join("|")}; //turn ids into an object for the POST request
			
			if(!this.cors){ //there's no cors support in the first place: use jsonp (batched, if necessary) for the requests
				return hashC.rwJSONP(q); //return the promise object from the jsonp request
			}
			else if ($.browser.msie && window.XDomainRequest) {  //handle that "edge" case, IE
				msdf = new XDomainRequest(); //even Microsft eventually decided that this was stupid, but we're still stuck with this
				msdf.open("post", url); //open the gates of stupid
				msdf.onprogress = function() {}; //f-ing IE9 requires this, for no good reason
				msdf.onload = function () {
					xdr.resolve(JSON.parse(this.responseText));  //should probably run this through the pipeFilter at some point
				};
				msdf.onerror = function () {
					xdr.reject();  //fail
				};
				msdf.ontimeout = function () {
					xdr.reject(); //also fail
				};
				msdf.send($.param(data));  //send forth the actual POST data into the gates of stupid
			} else {
				xdr = this.pipeFilter($.ajax({	//the basic ajax request for modern browsers that understand sensible stuff
					"url": url,
					type: "POST",
					"data": data,
					dataType: "json"
				}),q);
			}
			return xdr.promise();  //make sure that the original function call gets the promise so that it can handle responses/rejections sensibly
		},
		pipeFilter: function(promise, query){ 
			var r={};
			promise.pipe(function(d){
					//if the API is returning data 200, but has an error message instead of data, we'll set it to register as a fail
				if (!d.error){
					if(d.count){
						//api I've been using would return single id results with id name of "count" instead of the id. 
						//This fixes that craziness. If your API doesn't do this, Just return d and remove the conditional
						r[q.ids[0]] = d.count; 
						return r;
					} else {
						return d;
					}
				}
				else {
					return( $.Deferred().reject(d) );  //fail: return a new rejected deferred
				}
			},function(d){
				//if the request errors out immediately, then a CORS POST may not work after all, even though client CLAIMED it could handle it. 
				//we'll just switch to the backup jsonp method instead
				return hashC.rwJSONP(q);
			});
			return promise; //pass the promise back to whatever called it in the first place. We could have put this in the previous call, but people might get confused
		},
		rwJSONP: function (q) {
			var url = this.buildQS(q,false),
				df;
			if(url.length>maxUrlLength) {
				//oops, this query string is way, way too long to pass via a URI (...an URI??).  We're gonna to have to batch it
				return this.batchIt(q);
			}
			else{ 
				//we don't need no stinkin batches!
				df = pipeFilter($.ajax({
					url: url + "?format=jsonp",
					timeout: this.timeout,
					dataType: "jsonp"
				}),q);
				return df.promise();
			}
		},
		batchIt: function(q){
			var b = $.Deferred(), //the master promise that we'll eventually return to whatever called this function
				batches = [], //our collection of requests, each of which will itself be a promise of future results
				per=25, //some rough guess of how many ids to send at once. Any that are, themselves, too long will be split up again
				nq, // a variable to hold each new query string that we create
				nids=[]; //array to hold a growing list of ids, which will be emptied for each new batch of ids that we build
			
			$.each(q.ids,function(i,v){
				nids.push(v); //put the next value in the temp array for this batch
				if (nids.length===per) {  //check to see if a given array length is sensible enough to complete a batch
					nq = $.extend({}, q); //create a new query with all the same overall options as the original
					nq.ids = nids; //overwrite the ids in that query with a new, shorter collection
					batches.push(hashC.rwJSONP(nq,true));  //insert the completed promise into the batches array
					nids = []; //empty the collection in case we need to create a new batch
				}
			});
			$.when.apply(this,batches).then(function(){ //$.when is a collection of Deferreds that will fire a result once they all return
				//but now we need to merge all the "arguments" passed into $.when back together into a single result, oy
				var result ={}; //a place to hold our final result
				$.each(arguments,function(i,v){
					//mix the ids from this batch back into the final results object.  note that it's [0], not [i], because we're iterating over each "argument," which each contain collections of data and some other things we don't really care about,. We're not iterating through the collections directly
					$.extend(result,v[0]); 
				});
				b.resolve(result); //all the batches came in, so let's resolve the whole shebang
			},function(){
				b.reject(); //one of the batches failed.  darn. Everything FAILS
			});
			return b.promise(); //the whole function should then return a promise, just as if this were a single CORS POST that's returning a collected result
			}
		};
	
	window.hashC = hashC;  //we should let the global scope know that this stuff is awesome, and it should feel free to use it, unless something else has the same name, in which case, oops
}(jQuery));