/*!
 * CSSPlugin 3.15.0
 * https://gsap.com
 *
 * Copyright 2008-2026, GreenSock. All rights reserved.
 * Subject to the terms at https://gsap.com/standard-license
 * @author: Jack Doyle, jack@greensock.com
*/
/* eslint-disable */
import{gsap as t,_getProperty as e,_numExp as r,_numWithUnitExp as n,getUnit as i,_isString as s,_isUndefined as a,_renderComplexString as o,_relExp as p,_forEachName as l,_sortPropTweensByPriority as f,_colorStringFilter as u,_checkPlugin as c,_replaceRandom as h,_plugins as g,GSCache as d,PropTween as m,_config as v,_ticker as y,_round as x,_missingPlugin as b,_getSetter as O,_getCache as w,_colorExp as _,_parseRelative as M,_setDefaults as P,_removeLinkedListItem as C}from"./gsap-core.js";var A,S,F,Y,z,T,X,k,B,E,I,N={},D=180/Math.PI,V=Math.PI/180,j=Math.atan2,q=/([A-Z])/g,L=/(left|right|width|margin|padding|x)/i,R=/[\s,\(]\S/,W={autoAlpha:"opacity,visibility",scale:"scaleX,scaleY",alpha:"opacity"},Z=function(t,e){return e.set(e.t,e.p,Math.round(1e4*(e.s+e.c*t))/1e4+e.u,e)},G=function(t,e){return e.set(e.t,e.p,1===t?e.e:Math.round(1e4*(e.s+e.c*t))/1e4+e.u,e)},H=function(t,e){return e.set(e.t,e.p,t?Math.round(1e4*(e.s+e.c*t))/1e4+e.u:e.b,e)},
//if units change, we need a way to render the original unit/value when the tween goes all the way back to the beginning (ratio:0)
$=function(t,e){return e.set(e.t,e.p,1===t?e.e:t?Math.round(1e4*(e.s+e.c*t))/1e4+e.u:e.b,e)},
//if units change, we need a way to render the original unit/value when the tween goes all the way back to the beginning (ratio:0)
U=function(t,e){var r=e.s+e.c*t;e.set(e.t,e.p,~~(r+(r<0?-.5:.5))+e.u,e)},J=function(t,e){return e.set(e.t,e.p,t?e.e:e.b,e)},K=function(t,e){return e.set(e.t,e.p,1!==t?e.b:e.e,e)},Q=function(t,e,r){return t.style[e]=r},tt=function(t,e,r){return t.style.setProperty(e,r)},et=function(t,e,r){return t._gsap[e]=r},rt=function(t,e,r){return t._gsap.scaleX=t._gsap.scaleY=r},nt=function(t,e,r,n,i){var s=t._gsap;s.scaleX=s.scaleY=r,s.renderTransform(i,s)},it=function(t,e,r,n,i){var s=t._gsap;s[e]=r,s.renderTransform(i,s)},st="transform",at=st+"Origin",ot=function t(e,r){var n=this,i=this.target,s=i.style,a=i._gsap;if(e in N&&s){if(this.tfm=this.tfm||{},"transform"===e)return W.transform.split(",").forEach((function(e){return t.call(n,e,r)}));if(~(e=W[e]||e).indexOf(",")?e.split(",").forEach((function(t){return n.tfm[t]=Pt(i,t)})):this.tfm[e]=a.x?a[e]:Pt(i,e),// note: scale would map to "scaleX,scaleY", thus we loop and apply them both.
e===at&&(this.tfm.zOrigin=a.zOrigin),this.props.indexOf(st)>=0)return;a.svg&&(this.svgo=i.getAttribute("data-svg-origin"),this.props.push(at,r,"")),e=st}(s||r)&&this.props.push(e,r,s[e])},pt=function(t){t.translate&&(t.removeProperty("translate"),t.removeProperty("scale"),t.removeProperty("rotate"))},lt=function(){var t,e,r=this.props,n=this.target,i=n.style,s=n._gsap;for(t=0;t<r.length;t+=3)
// stored like this: property, isNotCSS, value
r[t+1]?2===r[t+1]?
// non-CSS value (function-based)
n[r[t]](r[t+2]):
// non-CSS value (not function-based)
n[r[t]]=r[t+2]:r[t+2]?i[r[t]]=r[t+2]:i.removeProperty("--"===r[t].substr(0,2)?r[t]:r[t].replace(q,"-$1").toLowerCase());if(this.tfm){for(e in this.tfm)s[e]=this.tfm[e];s.svg&&(s.renderTransform(),n.setAttribute("data-svg-origin",this.svgo||"")),(t=X())&&t.isStart||i[st]||(pt(i),s.zOrigin&&i[at]&&(i[at]+=" "+s.zOrigin+"px",// since we're uncaching, we must put the zOrigin back into the transformOrigin so that we can pull it out accurately when we parse again. Otherwise, we'd lose the z portion of the origin since we extract it to protect from Safari bugs.
s.zOrigin=0,s.renderTransform()),s.uncache=1)}},ft=function(e,r){var n={target:e,props:[],revert:lt,save:ot};// make sure it's a DOM node too.
return e._gsap||t.core.getCache(e),// just make sure there's a _gsap cache defined because we read from it in _saveStyle() and it's more efficient to just check it here once.
r&&e.style&&e.nodeType&&r.split(",").forEach((function(t){return n.save(t)})),n},ut=function(t,e){var r=S.createElementNS?S.createElementNS((e||"http://www.w3.org/1999/xhtml").replace(/^https/,"http"),t):S.createElement(t);//some servers swap in https for http in the namespace which can break things, making "style" inaccessible.
return r&&r.style?r:S.createElement(t);//some environments won't allow access to the element's style when created with a namespace in which case we default to the standard createElement() to work around the issue. Also note that when GSAP is embedded directly inside an SVG file, createElement() won't allow access to the style object in Firefox (see https://gsap.com/forums/topic/20215-problem-using-tweenmax-in-standalone-self-containing-svg-file-err-cannot-set-property-csstext-of-undefined/).
},ct=function t(e,r,n){var i=getComputedStyle(e);return i[r]||i.getPropertyValue(r.replace(q,"-$1").toLowerCase())||i.getPropertyValue(r)||!n&&t(e,gt(r)||r,1)||"";//css variables may not need caps swapped out for dashes and lowercase.
},ht="O,Moz,ms,Ms,Webkit".split(","),gt=function(t,e,r){var n=(e||z).style,i=5;if(t in n&&!r)return t;for(t=t.charAt(0).toUpperCase()+t.substr(1);i--&&!(ht[i]+t in n););return i<0?null:(3===i?"ms":i>=0?ht[i]:"")+t},dt=function(){"undefined"!=typeof window&&window.document&&(A=window,S=A.document,F=S.documentElement,z=ut("div")||{style:{}},ut("div"),st=gt(st),at=st+"Origin",z.style.cssText="border-width:0;line-height:0;position:absolute;padding:0",//make sure to override certain properties that may contaminate measurements, in case the user has overreaching style sheets.
k=!!gt("perspective"),X=t.core.reverting,Y=1)},mt=function(t){
//works around issues in some browsers (like Firefox) that don't correctly report getBBox() on SVG elements inside a <defs> element and/or <mask>. We try creating an SVG, adding it to the documentElement and toss the element in there so that it's definitely part of the rendering tree, then grab the bbox and if it works, we actually swap out the original getBBox() method for our own that does these extra steps whenever getBBox is needed. This helps ensure that performance is optimal (only do all these extra steps when absolutely necessary...most elements don't need it).
var e,r=t.ownerSVGElement,n=ut("svg",r&&r.getAttribute("xmlns")||"http://www.w3.org/2000/svg"),i=t.cloneNode(!0);i.style.display="block",n.appendChild(i),F.appendChild(n);try{e=i.getBBox()}catch(t){}return n.removeChild(i),F.removeChild(n),e},vt=function(t,e){for(var r=e.length;r--;)if(t.hasAttribute(e[r]))return t.getAttribute(e[r])},yt=function(t){var e,r;try{e=t.getBBox();//Firefox throws errors if you try calling getBBox() on an SVG element that's not rendered (like in a <symbol> or <defs>). https://bugzilla.mozilla.org/show_bug.cgi?id=612118
}catch(n){e=mt(t),r=1}//some browsers (like Firefox) misreport the bounds if the element has zero width and height (it just assumes it's at x:0, y:0), thus we need to manually grab the position in that case.
return e&&(e.width||e.height)||r||(e=mt(t)),!e||e.width||e.x||e.y?e:{x:+vt(t,["x","cx","x1"])||0,y:+vt(t,["y","cy","y1"])||0,width:0,height:0}},xt=function(t){return!(!t.getCTM||t.parentNode&&!t.ownerSVGElement||!yt(t))},
//reports if the element is an SVG on which getBBox() actually works
bt=function(t,e){if(e){var r,n=t.style;e in N&&e!==at&&(e=st),n.removeProperty?("ms"!==(r=e.substr(0,2))&&"webkit"!==e.substr(0,6)||(
//Microsoft and some Webkit browsers don't conform to the standard of capitalizing the first prefix character, so we adjust so that when we prefix the caps with a dash, it's correct (otherwise it'd be "ms-transform" instead of "-ms-transform" for IE9, for example)
e="-"+e),n.removeProperty("--"===r?e:e.replace(q,"-$1").toLowerCase())):
//note: old versions of IE use "removeAttribute()" instead of "removeProperty()"
n.removeAttribute(e)}},Ot=function(t,e,r,n,i,s){var a=new m(t._pt,e,r,0,1,s?K:J);return t._pt=a,a.b=n,a.e=i,t._props.push(r),a},wt={deg:1,rad:1,turn:1},_t={grid:1,flex:1},
//takes a single value like 20px and converts it to the unit specified, like "%", returning only the numeric amount.
Mt=function t(e,r,n,i){var s,a,o,p,l=parseFloat(n)||0,f=(n+"").trim().substr((l+"").length)||"px",
// some browsers leave extra whitespace at the beginning of CSS variables, hence the need to trim()
u=z.style,c=L.test(r),h="svg"===e.tagName.toLowerCase(),g=(h?"client":"offset")+(c?"Width":"Height"),d=100,m="px"===i,v="%"===i;if(i===f||!l||wt[i]||wt[f])return l;if("px"!==f&&!m&&(l=t(e,r,n,"px")),p=e.getCTM&&xt(e),(v||"%"===f)&&(N[r]||~r.indexOf("adius")))return s=p?e.getBBox()[c?"width":"height"]:e[g],x(v?l/s*d:l/100*s);if(u[c?"width":"height"]=d+(m?f:i),a="rem"!==i&&~r.indexOf("adius")||"em"===i&&e.appendChild&&!h?e:e.parentNode,p&&(a=(e.ownerSVGElement||{}).parentNode),a&&a!==S&&a.appendChild||(a=S.body),(o=a._gsap)&&v&&o.width&&c&&o.time===y.time&&!o.uncache)return x(l/o.width*d);if(!v||"height"!==r&&"width"!==r)(v||"%"===f)&&!_t[ct(a,"display")]&&(u.position=ct(e,"position")),a===e&&(u.position="static"),// like for borderRadius, if it's a % we must have it relative to the target itself but that may not have position: relative or position: absolute in which case it'd go up the chain until it finds its offsetParent (bad). position: static protects against that.
a.appendChild(z),s=z[g],a.removeChild(z),u.position="absolute";else{
// if we're dealing with width/height that's inside a container with padding and/or it's a flexbox/grid container, we must apply it to the target itself rather than the _tempDiv in order to ensure complete accuracy, factoring in the parent's padding.
var b=e.style[r];e.style[r]=d+i,s=e[g],b?e.style[r]=b:bt(e,r)}return c&&v&&((o=w(a)).time=y.time,o.width=a[g]),x(m?s*l/d:s&&l?d/s*l:0)},Pt=function(t,r,n,i){var s;return Y||dt(),r in W&&"transform"!==r&&~(r=W[r]).indexOf(",")&&(r=r.split(",")[0]),N[r]&&"transform"!==r?(s=Et(t,i),s="transformOrigin"!==r?s[r]:s.svg?s.origin:It(ct(t,at))+" "+s.zOrigin+"px"):(!(s=t.style[r])||"auto"===s||i||~(s+"").indexOf("calc("))&&(s=Ft[r]&&Ft[r](t,r,n)||ct(t,r)||e(t,r)||("opacity"===r?1:0)),n&&!~(s+"").trim().indexOf(" ")?Mt(t,r,s,n)+n:s},Ct=function(t,e,r,i){
// note: we call _tweenComplexCSSString.call(pluginInstance...) to ensure that it's scoped properly. We may call it from within a plugin too, thus "this" would refer to the plugin.
if(!r||"none"===r){
// some browsers like Safari actually PREFER the prefixed property and mis-report the unprefixed value like clipPath (BUG). In other words, even though clipPath exists in the style ("clipPath" in target.style) and it's set in the CSS properly (along with -webkit-clip-path), Safari reports clipPath as "none" whereas WebkitClipPath reports accurately like "ellipse(100% 0% at 50% 0%)", so in this case we must SWITCH to using the prefixed property instead. See https://gsap.com/forums/topic/18310-clippath-doesnt-work-on-ios/
var s=gt(e,t,1),a=s&&ct(t,s,1);a&&a!==r?(e=s,r=a):"borderColor"===e&&(r=ct(t,"borderTopColor"))}var l,f,c,h,g,d,y,x,b,O,w,_=new m(this._pt,t.style,e,0,1,o),P=0,C=0;if(_.b=r,_.e=i,r+="","var(--"===(// ensure values are strings
i+="").substring(0,6)&&(i=ct(t,i.substring(4,i.indexOf(")")))),"auto"===i&&(d=t.style[e],t.style[e]=i,i=ct(t,e)||i,d?t.style[e]=d:bt(t,e)),u(l=[r,i]),i=l[1],c=(// pass an array with the starting and ending values and let the filter do whatever it needs to the values. If colors are found, it returns true and then we must match where the color shows up order-wise because for things like boxShadow, sometimes the browser provides the computed values with the color FIRST, but the user provides it with the color LAST, so flip them if necessary. Same for drop-shadow().
r=l[0]).match(n)||[],(i.match(n)||[]).length){for(;f=n.exec(i);)y=f[0],b=i.substring(P,f.index),g?g=(g+1)%5:"rgba("!==b.substr(-5)&&"hsla("!==b.substr(-5)||(g=1),y!==(d=c[C++]||"")&&(h=parseFloat(d)||0,w=d.substr((h+"").length),"="===y.charAt(1)&&(y=M(h,y)+w),x=parseFloat(y),O=y.substr((x+"").length),P=n.lastIndex-O.length,O||(
//if something like "perspective:300" is passed in and we must add a unit to the end
O=O||v.units[e]||w,P===i.length&&(i+=O,_.e+=O)),w!==O&&(h=Mt(t,e,d,O)||0),// these nested PropTweens are handled in a special way - we'll never actually call a render or setter method on them. We'll just loop through them in the parent complex string PropTween's render method.
_._pt={_next:_._pt,p:b||1===C?b:",",
//note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
s:h,c:x-h,m:g&&g<4||"zIndex"===e?Math.round:0});_.c=P<i.length?i.substring(P,i.length):""}else _.r="display"===e&&"none"===i?K:J;//start the linked list with this new PropTween. Remember, we call _tweenComplexCSSString.call(pluginInstance...) to ensure that it's scoped properly. We may call it from within another plugin too, thus "this" would refer to the plugin.
return p.test(i)&&(_.e=0),//if the end string contains relative values or dynamic random(...) values, delete the end it so that on the final render we don't actually set it to the string with += or -= characters (forces it to use the calculated value).
this._pt=_,_},At={top:"0%",bottom:"100%",left:"0%",right:"100%",center:"50%"},St=function(t,e){if(e.tween&&e.tween._time===e.tween._dur){var r,n,i,s=e.t,a=s.style,o=e.u,p=s._gsap;if("all"===o||!0===o)a.cssText="",n=1;else for(i=(o=o.split(",")).length;--i>-1;)r=o[i],N[r]&&(n=1,r="transformOrigin"===r?at:st),bt(s,r);n&&(bt(s,st),p&&(p.svg&&s.removeAttribute("transform"),a.scale=a.rotate=a.translate="none",Et(s,1),// force all the cached values back to "normal"/identity, otherwise if there's another tween that's already set to render transforms on this element, it could display the wrong values.
p.uncache=1,pt(a)))}},
// note: specialProps should return 1 if (and only if) they have a non-zero priority. It indicates we need to sort the linked list.
Ft={clearProps:function(t,e,r,n,i){if("isFromStart"!==i.data){var s=t._pt=new m(t._pt,e,r,0,0,St);return s.u=n,s.pr=-10,s.tween=i,t._props.push(r),1}}
/* className feature (about 0.4kb gzipped).
  , className(plugin, target, property, endValue, tween) {
  	let _renderClassName = (ratio, data) => {
  			data.css.render(ratio, data.css);
  			if (!ratio || ratio === 1) {
  				let inline = data.rmv,
  					target = data.t,
  					p;
  				target.setAttribute("class", ratio ? data.e : data.b);
  				for (p in inline) {
  					_removeProperty(target, p);
  				}
  			}
  		},
  		_getAllStyles = (target) => {
  			let styles = {},
  				computed = getComputedStyle(target),
  				p;
  			for (p in computed) {
  				if (isNaN(p) && p !== "cssText" && p !== "length") {
  					styles[p] = computed[p];
  				}
  			}
  			_setDefaults(styles, _parseTransform(target, 1));
  			return styles;
  		},
  		startClassList = target.getAttribute("class"),
  		style = target.style,
  		cssText = style.cssText,
  		cache = target._gsap,
  		classPT = cache.classPT,
  		inlineToRemoveAtEnd = {},
  		data = {t:target, plugin:plugin, rmv:inlineToRemoveAtEnd, b:startClassList, e:(endValue.charAt(1) !== "=") ? endValue : startClassList.replace(new RegExp("(?:\\s|^)" + endValue.substr(2) + "(?![\\w-])"), "") + ((endValue.charAt(0) === "+") ? " " + endValue.substr(2) : "")},
  		changingVars = {},
  		startVars = _getAllStyles(target),
  		transformRelated = /(transform|perspective)/i,
  		endVars, p;
  	if (classPT) {
  		classPT.r(1, classPT.d);
  		_removeLinkedListItem(classPT.d.plugin, classPT, "_pt");
  	}
  	target.setAttribute("class", data.e);
  	endVars = _getAllStyles(target, true);
  	target.setAttribute("class", startClassList);
  	for (p in endVars) {
  		if (endVars[p] !== startVars[p] && !transformRelated.test(p)) {
  			changingVars[p] = endVars[p];
  			if (!style[p] && style[p] !== "0") {
  				inlineToRemoveAtEnd[p] = 1;
  			}
  		}
  	}
  	cache.classPT = plugin._pt = new PropTween(plugin._pt, target, "className", 0, 0, _renderClassName, data, 0, -11);
  	if (style.cssText !== cssText) { //only apply if things change. Otherwise, in cases like a background-image that's pulled dynamically, it could cause a refresh. See https://gsap.com/forums/topic/20368-possible-gsap-bug-switching-classnames-in-chrome/.
  		style.cssText = cssText; //we recorded cssText before we swapped classes and ran _getAllStyles() because in cases when a className tween is overwritten, we remove all the related tweening properties from that class change (otherwise class-specific stuff can't override properties we've directly set on the target's style object due to specificity).
  	}
  	_parseTransform(target, true); //to clear the caching of transforms
  	data.css = new gsap.plugins.css();
  	data.css.init(target, changingVars, tween);
  	plugin._props.push(...data.css._props);
  	return 1;
  }
  */},
/*
 * --------------------------------------------------------------------------------------
 * TRANSFORMS
 * --------------------------------------------------------------------------------------
 */
Yt=[1,0,0,1,0,0],zt={},Tt=function(t){return"matrix(1, 0, 0, 1, 0, 0)"===t||"none"===t||!t},Xt=function(t){var e=ct(t,st);return Tt(e)?Yt:e.substr(7).match(r).map(x)},kt=function(t,e){var r,n,i,s,a=t._gsap||w(t),o=t.style,p=Xt(t);return a.svg&&t.getAttribute("transform")?"1,0,0,1,0,0"===(//ensures that even complex values like "translate(50,60) rotate(135,0,0)" are parsed because it mashes it into a matrix.
p=[(i=t.transform.baseVal.consolidate().matrix).a,i.b,i.c,i.d,i.e,i.f]).join(",")?Yt:p:(p!==Yt||t.offsetParent||t===F||a.svg||(
//note: if offsetParent is null, that means the element isn't in the normal document flow, like if it has display:none or one of its ancestors has display:none). Firefox returns null for getComputedStyle() if the element is in an iframe that has display:none. https://bugzilla.mozilla.org/show_bug.cgi?id=548397
//browsers don't report transforms accurately unless the element is in the DOM and has a display value that's not "none". Firefox and Microsoft browsers have a partial bug where they'll report transforms even if display:none BUT not any percentage-based values like translate(-50%, 8px) will be reported as if it's translate(0, 8px).
i=o.display,o.display="block",(r=t.parentNode)&&(t.offsetParent||t.getBoundingClientRect().width)||(
// note: in 3.3.0 we switched target.offsetParent to _doc.body.contains(target) to avoid [sometimes unnecessary] MutationObserver calls but that wasn't adequate because there are edge cases where nested position: fixed elements need to get reparented to accurately sense transforms. See https://github.com/greensock/GSAP/issues/388 and https://github.com/greensock/GSAP/issues/375. Note: position: fixed elements report a null offsetParent but they could also be invisible because they're in an ancestor with display: none, so we check getBoundingClientRect(). We only want to alter the DOM if we absolutely have to because it can cause iframe content to reload, like a Vimeo video.
s=1,//flag
n=t.nextElementSibling,F.appendChild(t)),p=Xt(t),i?o.display=i:bt(t,"display"),s&&(n?r.insertBefore(t,n):r?r.appendChild(t):F.removeChild(t))),e&&p.length>6?[p[0],p[1],p[4],p[5],p[12],p[13]]:p)},Bt=function(t,e,r,n,i,s){var a,o,p,l=t._gsap,f=i||kt(t,!0),u=l.xOrigin||0,c=l.yOrigin||0,h=l.xOffset||0,g=l.yOffset||0,d=f[0],m=f[1],v=f[2],y=f[3],x=f[4],b=f[5],O=e.split(" "),w=parseFloat(O[0])||0,_=parseFloat(O[1])||0;r?f!==Yt&&(o=d*y-m*v)&&(
//if it's zero (like if scaleX and scaleY are zero), skip it to avoid errors with dividing by zero.
p=w*(-m/o)+_*(d/o)-(d*b-m*x)/o,w=w*(y/o)+_*(-v/o)+(v*b-y*x)/o,_=p):(w=(a=yt(t)).x+(~O[0].indexOf("%")?w/100*a.width:w),_=a.y+(~(O[1]||O[0]).indexOf("%")?_/100*a.height:_)),n||!1!==n&&l.smooth?(x=w-u,b=_-c,l.xOffset=h+(x*d+b*v)-x,l.yOffset=g+(x*m+b*y)-b):l.xOffset=l.yOffset=0,l.xOrigin=w,l.yOrigin=_,l.smooth=!!n,l.origin=e,l.originIsAbsolute=!!r,t.style[at]="0px 0px",//otherwise, if someone sets  an origin via CSS, it will likely interfere with the SVG transform attribute ones (because remember, we're baking the origin into the matrix() value).
s&&(Ot(s,l,"xOrigin",u,w),Ot(s,l,"yOrigin",c,_),Ot(s,l,"xOffset",h,l.xOffset),Ot(s,l,"yOffset",g,l.yOffset)),t.setAttribute("data-svg-origin",w+" "+_)},Et=function(t,e){var r=t._gsap||new d(t);if("x"in r&&!e&&!r.uncache)return r;var n,i,s,a,o,p,l,f,u,c,h,g,m,y,b,O,w,_,M,P,C,A,S,F,Y,z,T,X,B,E,I,N,q=t.style,L=r.scaleX<0,R="px",W="deg",Z=getComputedStyle(t),G=ct(t,at)||"0";return n=i=s=p=l=f=u=c=h=0,a=o=1,r.svg=!(!t.getCTM||!xt(t)),Z.translate&&(
// accommodate independent transforms by combining them into normal ones.
"none"===Z.translate&&"none"===Z.scale&&"none"===Z.rotate||(q[st]=("none"!==Z.translate?"translate3d("+(Z.translate+" 0 0").split(" ").slice(0,3).join(", ")+") ":"")+("none"!==Z.rotate?"rotate("+Z.rotate+") ":"")+("none"!==Z.scale?"scale("+Z.scale.split(" ").join(",")+") ":"")+("none"!==Z[st]?Z[st]:"")),q.scale=q.rotate=q.translate="none"),y=kt(t,r.svg),r.svg&&(r.uncache?(
// if cache.uncache is true (and maybe if origin is 0,0), we need to set element.style.transformOrigin = (cache.xOrigin - bbox.x) + "px " + (cache.yOrigin - bbox.y) + "px". Previously we let the data-svg-origin stay instead, but when introducing revert(), it complicated things.
Y=t.getBBox(),G=r.xOrigin-Y.x+"px "+(r.yOrigin-Y.y)+"px",F=""):F=!e&&t.getAttribute("data-svg-origin"),Bt(t,F||G,!!F||r.originIsAbsolute,!1!==r.smooth,y)),g=r.xOrigin||0,m=r.yOrigin||0,y!==Yt&&(_=y[0],//a11
M=y[1],//a21
P=y[2],//a31
C=y[3],//a41
n=A=y[4],i=S=y[5],//2D matrix
6===y.length?(a=Math.sqrt(_*_+M*M),o=Math.sqrt(C*C+P*P),p=_||M?j(M,_)*D:0,(//note: if scaleX is 0, we cannot accurately measure rotation. Same for skewX with a scaleY of 0. Therefore, we default to the previously recorded value (or zero if that doesn't exist).
u=P||C?j(P,C)*D+p:0)&&(o*=Math.abs(Math.cos(u*V))),r.svg&&(n-=g-(g*_+m*P),i-=m-(g*M+m*C))):(N=y[6],E=y[7],T=y[8],X=y[9],B=y[10],I=y[11],n=y[12],i=y[13],s=y[14],l=(b=j(N,B))*D,//rotationX
b&&(F=A*(O=Math.cos(-b))+T*(w=Math.sin(-b)),Y=S*O+X*w,z=N*O+B*w,T=A*-w+T*O,X=S*-w+X*O,B=N*-w+B*O,I=E*-w+I*O,A=F,S=Y,N=z),f=(//rotationY
b=j(-P,B))*D,b&&(O=Math.cos(-b),I=C*(w=Math.sin(-b))+I*O,_=F=_*O-T*w,M=Y=M*O-X*w,P=z=P*O-B*w),p=(//rotationZ
b=j(M,_))*D,b&&(F=_*(O=Math.cos(b))+M*(w=Math.sin(b)),Y=A*O+S*w,M=M*O-_*w,S=S*O-A*w,_=F,A=Y),l&&Math.abs(l)+Math.abs(p)>359.9&&(
//when rotationY is set, it will often be parsed as 180 degrees different than it should be, and rotationX and rotation both being 180 (it looks the same), so we adjust for that here.
l=p=0,f=180-f),a=x(Math.sqrt(_*_+M*M+P*P)),o=x(Math.sqrt(S*S+N*N)),b=j(A,S),u=Math.abs(b)>2e-4?b*D:0,h=I?1/(I<0?-I:I):0),r.svg&&(
//sense if there are CSS transforms applied on an SVG element in which case we must overwrite them when rendering. The transform attribute is more reliable cross-browser, but we can't just remove the CSS ones because they may be applied in a CSS rule somewhere (not just inline).
F=t.getAttribute("transform"),r.forceCSS=t.setAttribute("transform","")||!Tt(ct(t,st)),F&&t.setAttribute("transform",F))),Math.abs(u)>90&&Math.abs(u)<270&&(L?(a*=-1,u+=p<=0?180:-180,p+=p<=0?180:-180):(o*=-1,u+=u<=0?180:-180)),e=e||r.uncache,r.x=n-((r.xPercent=n&&(!e&&r.xPercent||(Math.round(t.offsetWidth/2)===Math.round(-n)?-50:0)))?t.offsetWidth*r.xPercent/100:0)+R,r.y=i-((r.yPercent=i&&(!e&&r.yPercent||(Math.round(t.offsetHeight/2)===Math.round(-i)?-50:0)))?t.offsetHeight*r.yPercent/100:0)+R,r.z=s+R,r.scaleX=x(a),r.scaleY=x(o),r.rotation=x(p)+W,r.rotationX=x(l)+W,r.rotationY=x(f)+W,r.skewX=u+W,r.skewY=c+W,r.transformPerspective=h+R,(r.zOrigin=parseFloat(G.split(" ")[2])||!e&&r.zOrigin||0)&&(q[at]=It(G)),r.xOffset=r.yOffset=0,r.force3D=v.force3D,r.renderTransform=r.svg?Rt:k?Lt:Dt,r.uncache=0,r},It=function(t){return(t=t.split(" "))[0]+" "+t[1]},
//for handling transformOrigin values, stripping out the 3rd dimension
Nt=function(t,e,r){var n=i(e);return x(parseFloat(e)+parseFloat(Mt(t,"x",r+"px",n)))+n},Dt=function(t,e){e.z="0px",e.rotationY=e.rotationX="0deg",e.force3D=0,Lt(t,e)},Vt="0deg",jt="0px",qt=") ",Lt=function(t,e){var r=e||this,n=r.xPercent,i=r.yPercent,s=r.x,a=r.y,o=r.z,p=r.rotation,l=r.rotationY,f=r.rotationX,u=r.skewX,c=r.skewY,h=r.scaleX,g=r.scaleY,d=r.transformPerspective,m=r.force3D,v=r.target,y=r.zOrigin,x="",b="auto"===m&&t&&1!==t||!0===m;// Safari has a bug that causes it not to render 3D transform-origin values properly, so we force the z origin to 0, record it in the cache, and then do the math here to offset the translate values accordingly (basically do the 3D transform-origin part manually)
if(y&&(f!==Vt||l!==Vt)){var O,w=parseFloat(l)*V,_=Math.sin(w),M=Math.cos(w);w=parseFloat(f)*V,O=Math.cos(w),s=Nt(v,s,_*O*-y),a=Nt(v,a,-Math.sin(w)*-y),o=Nt(v,o,M*O*-y+y)}d!==jt&&(x+="perspective("+d+qt),(n||i)&&(x+="translate("+n+"%, "+i+"%) "),(b||s!==jt||a!==jt||o!==jt)&&(x+=o!==jt||b?"translate3d("+s+", "+a+", "+o+") ":"translate("+s+", "+a+qt),p!==Vt&&(x+="rotate("+p+qt),l!==Vt&&(x+="rotateY("+l+qt),f!==Vt&&(x+="rotateX("+f+qt),u===Vt&&c===Vt||(x+="skew("+u+", "+c+qt),1===h&&1===g||(x+="scale("+h+", "+g+qt),v.style[st]=x||"translate(0, 0)"},Rt=function(t,e){var r,n,i,s,a,o=e||this,p=o.xPercent,l=o.yPercent,f=o.x,u=o.y,c=o.rotation,h=o.skewX,g=o.skewY,d=o.scaleX,m=o.scaleY,v=o.target,y=o.xOrigin,b=o.yOrigin,O=o.xOffset,w=o.yOffset,_=o.forceCSS,M=parseFloat(f),P=parseFloat(u);c=parseFloat(c),h=parseFloat(h),(g=parseFloat(g))&&(
//for performance reasons, we combine all skewing into the skewX and rotation values. Remember, a skewY of 10 degrees looks the same as a rotation of 10 degrees plus a skewX of 10 degrees.
h+=g=parseFloat(g),c+=g),c||h?(c*=V,h*=V,r=Math.cos(c)*d,n=Math.sin(c)*d,i=Math.sin(c-h)*-m,s=Math.cos(c-h)*m,h&&(g*=V,a=Math.tan(h-g),i*=a=Math.sqrt(1+a*a),s*=a,g&&(a=Math.tan(g),r*=a=Math.sqrt(1+a*a),n*=a)),r=x(r),n=x(n),i=x(i),s=x(s)):(r=d,s=m,n=i=0),(M&&!~(f+"").indexOf("px")||P&&!~(u+"").indexOf("px"))&&(M=Mt(v,"x",f,"px"),P=Mt(v,"y",u,"px")),(y||b||O||w)&&(M=x(M+y-(y*r+b*i)+O),P=x(P+b-(y*n+b*s)+w)),(p||l)&&(
//The SVG spec doesn't support percentage-based translation in the "transform" attribute, so we merge it into the translation to simulate it.
a=v.getBBox(),M=x(M+p/100*a.width),P=x(P+l/100*a.height)),a="matrix("+r+","+n+","+i+","+s+","+M+","+P+")",v.setAttribute("transform",a),_&&(v.style[st]=a)},Wt=function(t,e,r,n,i){var a,o,p=360,l=s(i),f=parseFloat(i)*(l&&~i.indexOf("rad")?D:1)-n,u=n+f+"deg";return l&&("short"===(a=i.split("_")[1])&&(f%=p)!==f%180&&(f+=f<0?p:-360),"cw"===a&&f<0?f=(f+36e9)%p-~~(f/p)*p:"ccw"===a&&f>0&&(f=(f-36e9)%p-~~(f/p)*p)),t._pt=o=new m(t._pt,e,r,n,f,G),o.e=u,o.u="deg",t._props.push(r),o},Zt=function(t,e){
// Internet Explorer doesn't have Object.assign(), so we recreate it here.
for(var r in e)t[r]=e[r];return t},Gt=function(t,e,r){
//for handling cases where someone passes in a whole transform string, like transform: "scale(2, 3) rotate(20deg) translateY(30em)"
var n,s,a,o,p,l,f,u=Zt({},r._gsap),c=r.style;for(s in u.svg?(a=r.getAttribute("transform"),r.setAttribute("transform",""),c[st]=e,n=Et(r,1),bt(r,st),r.setAttribute("transform",a)):(a=getComputedStyle(r)[st],c[st]=e,n=Et(r,1),c[st]=a),N)(a=u[s])!==(o=n[s])&&"perspective,force3D,transformOrigin,svgOrigin".indexOf(s)<0&&(
//tweening to no perspective gives very unintuitive results - just keep the same perspective in that case.
p=i(a)!==(f=i(o))?Mt(r,s,a,f):parseFloat(a),l=parseFloat(o),t._pt=new m(t._pt,n,s,p,l-p,Z),t._pt.u=f||0,t._props.push(s));Zt(n,u)};// handle splitting apart padding, margin, borderWidth, and borderRadius into their 4 components. Firefox, for example, won't report borderRadius correctly - it will only do borderTopLeftRadius and the other corners. We also want to handle paddingTop, marginLeft, borderRightWidth, etc.
l("padding,margin,Width,Radius",(function(t,e){var r="Top",n="Right",i="Bottom",s="Left",a=(e<3?[r,n,i,s]:[r+s,r+n,i+n,i+s]).map((function(r){return e<2?t+r:"border"+r+t}));Ft[e>1?"border"+t:t]=function(t,e,r,n,i){var s,o;if(arguments.length<4)
// getter, passed target, property, and unit (from _get())
return s=a.map((function(e){return Pt(t,e,r)})),5===(o=s.join(" ")).split(s[0]).length?s[0]:o;s=(n+"").split(" "),o={},a.forEach((function(t,e){return o[t]=s[e]=s[e]||s[(e-1)/2|0]})),t.init(e,o,i)}}));export var CSSPlugin={name:"css",register:dt,targetTest:function(t){return t.style&&t.nodeType},init:function(t,e,r,n,a){var o,p,l,u,d,y,x,O,w,P,C,A,S,F,z,T,X,k,B,E,I,D=this._props,V=t.style,j=r.vars.startAt;for(x in Y||dt(),// we may call init() multiple times on the same plugin instance, like when adding special properties, so make sure we don't overwrite the revert data or inlineProps
this.styles=this.styles||ft(t),T=this.styles.props,this.tween=r,e)if("autoRound"!==x&&(p=e[x],!g[x]||!c(x,e,r,n,t,a)))if(d=typeof p,y=Ft[x],"function"===d&&(d=typeof(p=p.call(r,n,t,a))),"string"===d&&~p.indexOf("random(")&&(p=h(p)),y)y(this,t,x,p,r)&&(z=1);else if("--"===x.substr(0,2))
//CSS variable
o=(getComputedStyle(t).getPropertyValue(x)+"").trim(),p+="",_.lastIndex=0,_.test(o)||(
// colors don't have units
O=i(o),(w=i(p))?O!==w&&(o=Mt(t,x,o,w)+w):O&&(p+=O)),this.add(V,"setProperty",o,p,n,a,0,0,x),D.push(x),T.push(x,0,V[x]);else if("undefined"!==d){//--- TRANSFORM-RELATED ---
if(j&&x in j?(
// in case someone hard-codes a complex value as the start, like top: "calc(2vh / 2)". Without this, it'd use the computed value (always in px)
o="function"==typeof j[x]?j[x].call(r,n,t,a):j[x],s(o)&&~o.indexOf("random(")&&(o=h(o)),i(o+"")||"auto"===o||(o+=v.units[x]||i(Pt(t,x))||""),// for cases when someone passes in a unitless value like {x: 100}; if we try setting translate(100, 0px) it won't work.
"="===(o+"").charAt(1)&&(o=Pt(t,x))):o=Pt(t,x),u=parseFloat(o),(P="string"===d&&"="===p.charAt(1)&&p.substr(0,2))&&(p=p.substr(2)),l=parseFloat(p),x in W&&("autoAlpha"===x&&(
//special case where we control the visibility along with opacity. We still allow the opacity value to pass through and get tweened.
1===u&&"hidden"===Pt(t,"visibility")&&l&&(
//if visibility is initially set to "hidden", we should interpret that as intent to make opacity 0 (a convenience)
u=0),T.push("visibility",0,V.visibility),Ot(this,V,"visibility",u?"inherit":"hidden",l?"inherit":"hidden",!l)),"scale"!==x&&"transform"!==x&&~(x=W[x]).indexOf(",")&&(x=x.split(",")[0])),C=x in N){// this is always the same as endValue except when it's a var(--) value, in which case we need to calculate the end value.
if(this.styles.save(x),X=p,"string"===d&&"var(--"===p.substring(0,6)){if("calc("===(p=ct(t,p.substring(4,p.indexOf(")")))).substring(0,5)){var q=t.style.perspective;t.style.perspective=p,p=ct(t,"perspective"),q?t.style.perspective=q:bt(t,"perspective")}l=parseFloat(p)}if(A||((S=t._gsap).renderTransform&&!e.parseTransform||Et(t,e.parseTransform),// if, for example, gsap.set(... {transform:"translateX(50vw)"}), the _get() call doesn't parse the transform, thus cache.renderTransform won't be set yet so force the parsing of the transform here.
F=!1!==e.smoothOrigin&&S.smooth,//the first time through, create the rendering PropTween so that it runs LAST (in the linked list, we keep adding to the beginning)
(A=this._pt=new m(this._pt,V,st,0,1,S.renderTransform,S,0,-1)).dep=1),"scale"===x)this._pt=new m(this._pt,S,"scaleY",S.scaleY,(P?M(S.scaleY,P+l):l)-S.scaleY||0,Z),this._pt.u=0,D.push("scaleY",x),x+="X";else{if("transformOrigin"===x){T.push(at,0,V[at]),B=void 0,E=void 0,I=void 0,B=(k=p).split(" "),E=B[0],I=B[1]||"50%","top"!==E&&"bottom"!==E&&"left"!==I&&"right"!==I||(
//the user provided them in the wrong order, so flip them
k=E,E=I,I=k),B[0]=At[E]||E,B[1]=At[I]||I,p=B.join(" "),//in case something like "left top" or "bottom right" is passed in. Convert to percentages.
S.svg?Bt(t,p,0,F,0,this):(//handle the zOrigin separately!
(w=parseFloat(p.split(" ")[2])||0)!==S.zOrigin&&Ot(this,S,"zOrigin",S.zOrigin,w),Ot(this,V,x,It(o),It(p)));continue}if("svgOrigin"===x){Bt(t,p,1,F,0,this);continue}if(x in zt){Wt(this,S,x,u,P?M(u,P+p):p);continue}if("smoothOrigin"===x){Ot(this,S,"smooth",S.smooth,p);continue}if("force3D"===x){S[x]=p;continue}if("transform"===x){Gt(this,p,t);continue}}}else x in V||(x=gt(x)||x);if(C||(l||0===l)&&(u||0===u)&&!R.test(p)&&x in V)l||(l=0),(O=(o+"").substr((u+"").length))!==(// protect against NaN
w=i(p)||(x in v.units?v.units[x]:O))&&(u=Mt(t,x,o,w)),this._pt=new m(this._pt,C?S:V,x,u,(P?M(u,P+l):l)-u,C||"px"!==w&&"zIndex"!==x||!1===e.autoRound?Z:U),this._pt.u=w||0,C&&X!==p?(this._pt.b=o,this._pt.e=X,this._pt.r=$):O!==w&&"%"!==w&&(
//when the tween goes all the way back to the beginning, we need to revert it to the OLD/ORIGINAL value (with those units). We record that as a "b" (beginning) property and point to a render method that handles that. (performance optimization)
this._pt.b=o,this._pt.r=H);else if(x in V)Ct.call(this,t,x,o,P?P+p:p);else if(x in t)
//maybe it's not a style - it could be a property added directly to an element in which case we'll try to animate that.
this.add(t,x,o||t[x],P?P+p:p,n,a);else if("parseTransform"!==x){b(x,p);continue}C||(x in V?T.push(x,0,V[x]):"function"==typeof t[x]?T.push(x,2,t[x]()):T.push(x,1,o||t[x])),D.push(x)}z&&f(this)},render:function(t,e){if(e.tween._time||!X())for(var r=e._pt;r;)r.r(t,r.d),r=r._next;else e.styles.revert()},get:Pt,aliases:W,getSetter:function(t,e,r){
//returns a setter function that accepts target, property, value and applies it accordingly. Remember, properties like "x" aren't as simple as target.style.property = value because they've got to be applied to a proxy object and then merged into a transform string in a renderer.
var n=W[e];return n&&n.indexOf(",")<0&&(e=n),e in N&&e!==at&&(t._gsap.x||Pt(t,"x"))?r&&T===r?"scale"===e?rt:et:(T=r||{})&&("scale"===e?nt:it):t.style&&!a(t.style[e])?Q:~e.indexOf("-")?tt:O(t,e)},core:{_removeProperty:bt,_getMatrix:kt}};t.utils.checkPrefix=gt,t.core.getStyleSaver=ft,I=l((B="x,y,z,scale,scaleX,scaleY,xPercent,yPercent")+","+(E="rotation,rotationX,rotationY,skewX,skewY")+",transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective",(function(t){N[t]=1})),l(E,(function(t){v.units[t]="deg",zt[t]=1})),W[I[13]]=B+","+E,l("0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY",(function(t){var e=t.split(":");W[e[1]]=I[e[0]]})),l("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective",(function(t){v.units[t]="px"})),t.registerPlugin(CSSPlugin);export{CSSPlugin as default,yt as _getBBox,ut as _createElement,gt as checkPrefix};