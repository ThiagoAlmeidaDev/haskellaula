/*!
 * paths 3.15.0
 * https://gsap.com
 *
 * Copyright 2008-2026, GreenSock. All rights reserved.
 * Subject to the terms at https://gsap.com/standard-license
 * @author: Jack Doyle, jack@greensock.com
*/
/* eslint-disable */
var t,e=/[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,n=/(?:(-)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,r=/[\+\-]?\d*\.?\d+e[\+\-]?\d+/gi,o=/(^[#\.][a-z]|[a-y][a-z])/i,a=Math.PI/180,l=180/Math.PI,h=Math.sin,i=Math.cos,s=Math.abs,g=Math.sqrt,u=Math.atan2,p=1e8,c=function(t){return"string"==typeof t},f=function(t){return"number"==typeof t},v={},d={},m=1e5,x=function(t){return Math.round((t+p)%1*m)/m||(t<0?0:1)},
//if progress lands on 1, the % will make it 0 which is why we || 1, but not if it's negative because it makes more sense for motion to end at 0 in that case.
M=function(t){return Math.round(t*m)/m||0},P=function(t){return Math.round(1e10*t)/1e10||0},L=function(t){return t.closed=Math.abs(t[0]-t[t.length-2])<.001&&Math.abs(t[1]-t[t.length-1])<.001},w=function(t,e,n,r){var o=t[e],a=1===r?6:subdivideSegment(o,n,r);if((a||!r)&&a+n+2<o.length)return t.splice(e,0,o.slice(0,n+a+2)),o.splice(0,n+a),1},y=function(t,e,n){
// slightly slower way than doing this (when there's no lookup): segment.lookup[progress < 1 ? ~~(length / segment.minLength) : segment.lookup.length - 1] || 0;
var r=t.length,o=~~(n*r);if(t[o]>e){for(;--o&&t[o]>e;);o<0&&(o=0)}else for(;t[++o]<e&&o<r;);return o<r?o:r-1},b=function(t,e){return e.totalLength=t.totalLength,t.samples?(
//segment
e.samples=t.samples.slice(0),e.lookup=t.lookup.slice(0),e.minLength=t.minLength,e.resolution=t.resolution):t.totalPoints&&(
//rawPath
e.totalPoints=t.totalPoints),e},
//pushes a new segment into a rawPath, but if its starting values match the ending values of the last segment, it'll merge it into that same segment (to reduce the number of segments)
S=function(t,e){var n=t.length,r=t[n-1]||[],o=r.length;n&&e[0]===r[o-2]&&e[1]===r[o-1]&&(e=r.concat(e.slice(2)),n--),t[n]=e};
/* TERMINOLOGY
 - RawPath - an array of arrays, one for each Segment. A single RawPath could have multiple "M" commands, defining Segments (paths aren't always connected).
 - Segment - an array containing a sequence of Cubic Bezier coordinates in alternating x, y, x, y format. Starting anchor, then control point 1, control point 2, and ending anchor, then the next control point 1, control point 2, anchor, etc. Uses less memory than an array with a bunch of {x, y} points.
 - Bezier - a single cubic Bezier with a starting anchor, two control points, and an ending anchor.
 - the variable "t" is typically the position along an individual Bezier path (time) and it's NOT linear, meaning it could accelerate/decelerate based on the control points whereas the "p" or "progress" value is linearly mapped to the whole path, so it shouldn't really accelerate/decelerate based on control points. So a progress of 0.2 would be almost exactly 20% along the path. "t" is ONLY in an individual Bezier piece.
 */
//accepts basic selector text, a path instance, a RawPath instance, or a Segment and returns a RawPath (makes it easy to homogenize things). If an element or selector text is passed in, it'll also cache the value so that if it's queried again, it'll just take the path data from there instead of parsing it all over again (as long as the path data itself hasn't changed - it'll check).
export function getRawPath(t){var e,n=(t=c(t)&&o.test(t)&&document.querySelector(t)||t).getAttribute?t:0;return n&&(t=t.getAttribute("d"))?(
//implements caching
n._gsPath||(n._gsPath={}),(e=n._gsPath[t])&&!e._dirty?e:n._gsPath[t]=stringToRawPath(t)):t?c(t)?stringToRawPath(t):f(t[0])?[t]:t:console.warn("Expecting a <path> element or an SVG path data string")}//copies a RawPath WITHOUT the length meta data (for speed)
export function copyRawPath(t){for(var e=[],n=0;n<t.length;n++)e[n]=b(t[n],t[n].slice(0));return b(t,e)}export function reverseSegment(t){var e,n=0;//this will invert the order y, x, y, x so we must flip it back.
for(t.reverse();n<t.length;n+=2)e=t[n],t[n]=t[n+1],t[n+1]=e;t.reversed=!t.reversed}var R={rect:"rx,ry,x,y,width,height",circle:"r,cx,cy",ellipse:"rx,ry,cx,cy",line:"x1,x2,y1,y2"};//converts an SVG shape like <circle>, <rect>, <polygon>, <polyline>, <ellipse>, etc. to a <path>, swapping it in and copying the attributes to match.
export function convertToPath(t,e){var r,o,a,l,h,i,s,g,u,p,c,f,v,d,m,x,M,P,L,w,y,b,S=t.tagName.toLowerCase(),N=.552284749831;return"path"!==S&&t.getBBox?(i=function(t,e){var n,r=document.createElementNS("http://www.w3.org/2000/svg","path"),o=[].slice.call(t.attributes),a=o.length;for(e=","+e+",";--a>-1;)n=o[a].nodeName.toLowerCase(),//in Microsoft Edge, if you don't set the attribute with a lowercase name, it doesn't render correctly! Super weird.
e.indexOf(","+n+",")<0&&r.setAttributeNS(null,n,o[a].nodeValue);return r}(t,"x,y,width,height,cx,cy,rx,ry,r,x1,x2,y1,y2,points"),b=function(t,e){for(var n=e?e.split(","):[],r={},o=n.length;--o>-1;)r[n[o]]=+t.getAttribute(n[o])||0;return r}(t,R[S]),"rect"===S?(l=b.rx,h=b.ry||l,o=b.x,a=b.y,p=b.width-2*l,c=b.height-2*h,r=l||h?"M"+(x=(d=(v=o+l)+p)+l)+","+(P=a+h)+" V"+(L=P+c)+" C"+[x,w=L+h*N,m=d+l*N,y=L+h,d,y,d-(d-v)/3,y,v+(d-v)/3,y,v,y,
//if there are rounded corners, render cubic beziers
f=o+l*(1-N),y,o,w,o,L,o,L-(L-P)/3,o,P+(L-P)/3,o,P,o,M=a+h*(1-N),f,a,v,a,v+(d-v)/3,a,d-(d-v)/3,a,d,a,m,a,x,M,x,P].join(",")+"z":"M"+(o+p)+","+a+" v"+c+" h"+-p+" v"+-c+" h"+p+"z"):"circle"===S||"ellipse"===S?("circle"===S?g=(l=h=b.r)*N:(l=b.rx,g=(h=b.ry)*N),r="M"+((o=b.cx)+l)+","+(a=b.cy)+" C"+[o+l,a+g,o+(s=l*N),a+h,o,a+h,o-s,a+h,o-l,a+g,o-l,a,o-l,a-g,o-s,a-h,o,a-h,o+s,a-h,o+l,a-g,o+l,a].join(",")+"z"):"line"===S?r="M"+b.x1+","+b.y1+" L"+b.x2+","+b.y2:"polyline"!==S&&"polygon"!==S||(r="M"+(o=(u=(t.getAttribute("points")+"").match(n)||[]).shift())+","+(a=u.shift())+" L"+u.join(","),"polygon"===S&&(r+=","+o+","+a+"z")),i.setAttribute("d",rawPathToString(i._gsRawPath=stringToRawPath(r))),e&&t.parentNode&&(t.parentNode.insertBefore(i,t),t.parentNode.removeChild(t)),i):t}//returns the rotation (in degrees) at a particular progress on a rawPath (the slope of the tangent)
export function getRotationAtProgress(t,e){var n=k(t,e>=1?1-1e-9:e||1e-9);return N(n.segment,n.i,n.t)}function N(t,e,n){var r,o=t[e],a=t[e+2],h=t[e+4];return o+=(a-o)*n,o+=((a+=(h-a)*n)-o)*n,r=a+(h+(t[e+6]-h)*n-a)*n-o,o=t[e+1],o+=((a=t[e+3])-o)*n,o+=((a+=((h=t[e+5])-a)*n)-o)*n,M(u(a+(h+(t[e+7]-h)*n-a)*n-o,r)*l)}export function sliceRawPath(t,e,n){n=void 0===n?1:P(n)||0,// we must round to avoid issues like 4.15 / 8 = 0.8300000000000001 instead of 0.83 or 2.8 / 5 = 0.5599999999999999 instead of 0.56 and if someone is doing a loop like start: 2.8 / 0.5, end: 2.8 / 0.5 + 1.
e=P(e)||0;var r=Math.max(0,~~(s(n-e)-1e-8)),o=copyRawPath(t);if(e>n&&(e=1-e,n=1-n,function(t,e){var n=t.length;for(e||t.reverse();n--;)t[n].reversed||reverseSegment(t[n])}(o),o.totalLength=0),e<0||n<0){var a=Math.abs(~~Math.min(e,n))+1;e+=a,n+=a}o.totalLength||cacheRawPathMeasurements(o);var l,h,i,g,u,p,c,f,m=n>1,x=k(o,e,v,!0),M=k(o,n,d),L=M.segment,y=x.segment,b=M.segIndex,R=x.segIndex,T=M.i,z=x.i,A=R===b,C=T===z&&A;if(m||r){for(l=b<R||A&&T<z||C&&M.t<x.t,w(o,R,z,x.t)&&(R++,l||(b++,C?(M.t=(M.t-x.t)/(1-x.t),T=0):A&&(T-=z))),Math.abs(1-(n-e))<1e-5?b=R-1:!M.t&&b?b--:w(o,b,T,M.t)&&l&&R++,1===x.t&&(R=(R+1)%o.length),u=[],c=1+(p=o.length)*r,f=R,c+=(p-R+b)%p,g=0;g<c;g++)S(u,o[f++%p]);o=u}else if(i=1===M.t?6:subdivideSegment(L,T,M.t),e!==n)for(h=subdivideSegment(y,z,C?x.t/M.t:x.t),A&&(i+=h),L.splice(T+i+2),(h||z)&&y.splice(0,z+h),g=o.length;g--;)
//chop off any extra segments
(g<R||g>b)&&o.splice(g,1);else L.angle=N(L,T+i,0),x=L[//record the value before we chop because it'll be impossible to determine the angle after its length is 0!
T+=i],M=L[T+1],L.length=L.totalLength=0,L.totalPoints=o.totalPoints=8,L.push(x,M,x,M,x,M,x,M);return o.totalLength=0,o}//measures a Segment according to its resolution (so if segment.resolution is 6, for example, it'll take 6 samples equally across each Bezier) and create/populate a "samples" Array that has the length up to each of those sample points (always increasing from the start) as well as a "lookup" array that's broken up according to the smallest distance between 2 samples. This gives us a very fast way of looking up a progress position rather than looping through all the points/Beziers. You can optionally have it only measure a subset, starting at startIndex and going for a specific number of beziers (remember, there are 3 x/y pairs each, for a total of 6 elements for each Bezier). It will also populate a "totalLength" property, but that's not generally super accurate because by default it'll only take 6 samples per Bezier. But for performance reasons, it's perfectly adequate for measuring progress values along the path. If you need a more accurate totalLength, either increase the resolution or use the more advanced bezierToPoints() method which keeps adding points until they don't deviate by more than a certain precision value.
function T(t,e,n){e=e||0,t.samples||(t.samples=[],t.lookup=[]);var r,o,a,l,h,i,u,c,f,v,d,m,x,M,P,L,w,y=~~t.resolution||12,b=1/y,S=n?e+6*n+1:t.length,R=t[e],N=t[e+1],T=e?e/6*y:0,k=t.samples,z=t.lookup,A=(e?t.minLength:p)||p,C=k[T+n*y-1],_=e?k[T-1]:0;for(k.length=z.length=0,o=e+2;o<S;o+=6){if(a=t[o+4]-R,l=t[o+2]-R,h=t[o]-R,c=t[o+5]-N,f=t[o+3]-N,v=t[o+1]-N,i=u=d=m=0,s(a)<.01&&s(c)<.01&&s(h)+s(v)<.01)
// dump points that are close enough (basically right on top of each other, making a bezier super tiny or 0 length)
t.length>8&&(t.splice(o,6),o-=6,S-=6);else for(r=1;r<=y;r++)i=u-(u=((M=b*r)*M*a+3*(x=1-M)*(M*l+x*h))*M),d=m-(m=(M*M*c+3*x*(M*f+x*v))*M),(L=g(d*d+i*i))<A&&(A=L),_+=L,k[T++]=_;R+=a,N+=c}if(C)for(C-=_;T<k.length;T++)k[T]+=C;if(k.length&&A){if(t.totalLength=w=k[k.length-1]||0,t.minLength=A,w/A<9999)for(
// if the lookup would require too many values (memory problem), we skip this and instead we use a loop to lookup values directly in the samples Array
L=P=0,r=0;r<w;r+=A)z[L++]=k[P]<r?++P:P}else t.totalLength=k[0]=0;return e?_-k[e/2-1]:_}export function cacheRawPathMeasurements(t,e){var n,r,o;for(o=n=r=0;o<t.length;o++)t[o].resolution=~~e||12,//steps per Bezier curve (anchor, 2 control points, to anchor)
n+=T(t[o]),// note: measureSegment() also removes points that are basically on top of each other, so the segment.length may change!
r+=t[o].length;return t.totalPoints=r,t.totalLength=n,t}//divide segment[i] at position t (value between 0 and 1, progress along that particular cubic bezier segment that starts at segment[i]). Returns how many elements were spliced into the segment array (either 0 or 6)
export function subdivideSegment(t,e,n){if(n<=0||n>=1)return 0;var r=t[e],o=t[e+1],a=t[e+2],l=t[e+3],h=t[e+4],i=t[e+5],s=r+(a-r)*n,g=a+(h-a)*n,u=o+(l-o)*n,p=l+(i-l)*n,c=s+(g-s)*n,f=u+(p-u)*n,v=h+(t[e+6]-h)*n,d=i+(t[e+7]-i)*n;return g+=(v-g)*n,p+=(d-p)*n,t.splice(e+2,4,M(s),//first control point
M(u),M(c),//second control point
M(f),M(c+(g-c)*n),//new fabricated anchor on line
M(f+(p-f)*n),M(g),//third control point
M(p),M(v),//fourth control point
M(d)),t.samples&&t.samples.splice(e/6*t.resolution|0,0,0,0,0,0,0,0),6}// returns an object {path, segment, segIndex, i, t}
function k(t,e,n,r){n=n||{},t.totalLength||cacheRawPathMeasurements(t),(e<0||e>1)&&(e=x(e));var o,a,l,h,i,s,g,u=0,p=t[0];if(e)if(1===e)g=1,s=(p=t[u=t.length-1]).length-8;else{if(t.length>1){for(
//speed optimization: most of the time, there's only one segment so skip the recursion.
l=t.totalLength*e,i=s=0;(i+=t[s++].totalLength)<l;)u=s;e=(l-(h=i-(p=t[u]).totalLength))/(i-h)||0}o=p.samples,a=p.resolution,//how many samples per cubic bezier chunk
l=p.totalLength*e,h=(s=p.lookup.length?p.lookup[~~(l/p.minLength)]||0:y(o,l,e))?o[s-1]:0,(i=o[s])<l&&(h=i,i=o[++s]),g=1/a*((l-h)/(i-h)+s%a),s=6*~~(s/a),r&&1===g&&(s+6<p.length?(s+=6,g=0):u+1<t.length&&(s=g=0,p=t[++u]))}else g=s=u=0,p=t[0];return n.t=g,n.i=s,n.path=t,n.segment=p,n.segIndex=u,n}export function getPositionOnPath(t,e,n,r){var o,a,l,h,i,s,g,u,p,c=t[0],f=r||{};if((e<0||e>1)&&(e=x(e)),c.lookup||cacheRawPathMeasurements(t),t.length>1){for(
//speed optimization: most of the time, there's only one segment so skip the recursion.
l=t.totalLength*e,i=s=0;(i+=t[s++].totalLength)<l;)c=t[s];e=(l-(h=i-c.totalLength))/(i-h)||0}return o=c.samples,a=c.resolution,l=c.totalLength*e,h=(s=c.lookup.length?c.lookup[e<1?~~(l/c.minLength):c.lookup.length-1]||0:y(o,l,e))?o[s-1]:0,(i=o[s])<l&&(h=i,i=o[++s]),p=1-(g=1/a*((l-h)/(i-h)+s%a)||0),u=c[s=6*~~(s/a)],f.x=M((g*g*(c[s+6]-u)+3*p*(g*(c[s+4]-u)+p*(c[s+2]-u)))*g+u),f.y=M((g*g*(c[s+7]-(u=c[s+1]))+3*p*(g*(c[s+5]-u)+p*(c[s+3]-u)))*g+u),n&&(f.angle=c.totalLength?N(c,s,g>=1?1-1e-9:g||1e-9):c.angle||0),f}//applies a matrix transform to RawPath (or a segment in a RawPath) and returns whatever was passed in (it transforms the values in the array(s), not a copy).
export function transformRawPath(t,e,n,r,o,a,l){for(var h,i,s,g,u,p=t.length;--p>-1;)for(i=(h=t[p]).length,s=0;s<i;s+=2)g=h[s],u=h[s+1],h[s]=g*e+u*r+a,h[s+1]=g*n+u*o+l;return t._dirty=1,t}// translates SVG arc data into a segment (cubic beziers). Angle is in degrees.
function z(t,e,n,r,o,l,u,p,c){if(t!==p||e!==c){n=s(n),r=s(r);var f=o%360*a,v=i(f),d=h(f),m=Math.PI,x=2*m,M=(t-p)/2,P=(e-c)/2,L=v*M+d*P,w=-d*M+v*P,y=L*L,b=w*w,S=y/(n*n)+b/(r*r);S>1&&(n=g(S)*n,r=g(S)*r);var R=n*n,N=r*r,T=(R*N-R*b-N*y)/(R*b+N*y);T<0&&(T=0);var k=(l===u?-1:1)*g(T),z=k*(n*w/r),A=k*(-r*L/n),C=(t+p)/2+(v*z-d*A),_=(e+c)/2+(d*z+v*A),F=(L-z)/n,I=(w-A)/r,j=(-L-z)/n,V=(-w-A)/r,q=F*F+I*I,B=(I<0?-1:1)*Math.acos(F/g(q)),E=(F*V-I*j<0?-1:1)*Math.acos((F*j+I*V)/g(q*(j*j+V*V)));isNaN(E)&&(E=m),//rare edge case. Math.cos(-1) is NaN.
!u&&E>0?E-=x:u&&E<0&&(E+=x),B%=x,E%=x;var O,D=Math.ceil(s(E)/(x/4)),Z=[],G=E/D,H=4/3*h(G/2)/(1+i(G/2)),Q=v*n,U=d*n,J=d*-r,K=v*r;for(O=0;O<D;O++)L=i(o=B+O*G),w=h(o),F=i(o+=G),I=h(o),Z.push(L-H*w,w+H*L,F+H*I,I-H*F,F,I);//now transform according to the actual size of the ellipse/arc (the beziers were noramlized, between 0 and 1 on a circle).
for(O=0;O<Z.length;O+=2)L=Z[O],w=Z[O+1],Z[O]=L*Q+w*J+C,Z[O+1]=L*U+w*K+_;return Z[O-2]=p,//always set the end to exactly where it's supposed to be
Z[O-1]=c,Z}}//Spits back a RawPath with absolute coordinates. Each segment starts with a "moveTo" command (x coordinate, then y) and then 2 control points (x, y, x, y), then anchor. The goal is to minimize memory and maximize speed.
export function stringToRawPath(t){var n,o,a,l,h,i,g,u,p,c,f,v,d,m,x,M=(t+"").replace(r,(function(t){var e=+t;return e<1e-4&&e>-1e-4?0:e})).match(e)||[],
//some authoring programs spit out very small numbers in scientific notation like "1e-5", so make sure we round that down to 0 first.
P=[],w=0,y=0,b=2/3,S=M.length,R=0,N="ERROR: malformed path: "+t,T=function(t,e,n,r){c=(n-t)/3,f=(r-e)/3,g.push(t+c,e+f,n-c,r-f,n,r)};if(!t||!isNaN(M[0])||isNaN(M[1]))return console.log(N),P;for(n=0;n<S;n++)// "M" (move)
if(d=h,isNaN(M[n])?i=(h=M[n].toUpperCase())!==M[n]:
//commands like "C" can be strung together without any new command characters between.
n--,a=+M[n+1],l=+M[n+2],i&&(a+=w,l+=y),n||(u=a,p=l),"M"===h)g&&(g.length<8?
//if the path data was funky and just had a M with no actual drawing anywhere, skip it.
P.length-=1:R+=g.length,L(g)),w=u=a,y=p=l,g=[a,l],P.push(g),n+=2,h="L";else if("C"===h)g||(g=[0,0]),i||(w=y=0),//note: "*1" is just a fast/short way to cast the value as a Number. WAAAY faster in Chrome, slightly slower in Firefox.
g.push(a,l,w+1*M[n+3],y+1*M[n+4],w+=1*M[n+5],y+=1*M[n+6]),n+=6;else if("S"===h)c=w,f=y,"C"!==d&&"S"!==d||(c+=w-g[g.length-4],f+=y-g[g.length-3]),i||(w=y=0),g.push(c,f,a,l,w+=1*M[n+3],y+=1*M[n+4]),n+=4;else if("Q"===h)c=w+(a-w)*b,f=y+(l-y)*b,i||(w=y=0),w+=1*M[n+3],y+=1*M[n+4],g.push(c,f,w+(a-w)*b,y+(l-y)*b,w,y),n+=4;else if("T"===h)c=w-g[g.length-4],f=y-g[g.length-3],g.push(w+c,y+f,a+(w+1.5*c-a)*b,l+(y+1.5*f-l)*b,w=a,y=l),n+=2;else if("H"===h)T(w,y,w=a,y),n+=1;else if("V"===h)
//adjust values because the first (and only one) isn't x in this case, it's y.
T(w,y,w,y=a+(i?y-w:0)),n+=1;else if("L"===h||"Z"===h)"Z"===h&&(a=u,l=p,g.closed=!0),("L"===h||s(w-a)>.5||s(y-l)>.5)&&(T(w,y,a,l),"L"===h&&(n+=2)),w=a,y=l;else if("A"===h){if(m=M[n+4],x=M[n+5],c=M[n+6],f=M[n+7],o=7,m.length>1&&(
// for cases when the flags are merged, like "a8 8 0 018 8" (the 0 and 1 flags are WITH the x value of 8, but it could also be "a8 8 0 01-8 8" so it may include x or not)
m.length<3?(f=c,c=x,o--):(f=x,c=m.substr(2),o-=2),x=m.charAt(1),m=m.charAt(0)),v=z(w,y,+M[n+1],+M[n+2],+M[n+3],+m,+x,(i?w:0)+1*c,(i?y:0)+1*f),n+=o,v)for(o=0;o<v.length;o++)g.push(v[o]);w=g[g.length-2],y=g[g.length-1]}else console.log(N);return(n=g.length)<6?(
//in case there's odd SVG like a M0,0 command at the very end.
P.pop(),n=0):L(g),P.totalPoints=R+n,P}//populates the points array in alternating x/y values (like [x, y, x, y...] instead of individual point objects [{x, y}, {x, y}...] to conserve memory and stay in line with how we're handling segment arrays
export function bezierToPoints(t,e,n,r,o,a,l,h,i,g,u){var p,c=(t+n)/2,f=(e+r)/2,v=(n+o)/2,d=(r+a)/2,m=(o+l)/2,x=(a+h)/2,M=(c+v)/2,P=(f+d)/2,L=(v+m)/2,w=(d+x)/2,y=(M+L)/2,b=(P+w)/2,S=l-t,R=h-e,N=s((n-l)*R-(r-h)*S),T=s((o-l)*R-(a-h)*S);return g||(g=[t,e,l,h],u=2),g.splice(u||g.length-2,0,y,b),(N+T)*(N+T)>i*(S*S+R*R)&&(p=g.length,bezierToPoints(t,e,c,f,M,P,y,b,i,g,u),bezierToPoints(y,b,L,w,m,x,l,h,i,g,u+2+(g.length-p))),g}
/*
function getAngleBetweenPoints(x0, y0, x1, y1, x2, y2) { //angle between 3 points in radians
	var dx1 = x1 - x0,
		dy1 = y1 - y0,
		dx2 = x2 - x1,
		dy2 = y2 - y1,
		dx3 = x2 - x0,
		dy3 = y2 - y0,
		a = dx1 * dx1 + dy1 * dy1,
		b = dx2 * dx2 + dy2 * dy2,
		c = dx3 * dx3 + dy3 * dy3;
	return Math.acos( (a + b - c) / _sqrt(4 * a * b) );
},
*/
//pointsToSegment() doesn't handle flat coordinates (where y is always 0) the way we need (the resulting control points are always right on top of the anchors), so this function basically makes the control points go directly up and down, varying in length based on the curviness (more curvy, further control points)
export function flatPointsToSegment(t,e){void 0===e&&(e=1);for(var n=t[0],r=0,o=[n,r],a=2;a<t.length;a+=2)o.push(n,r,t[a],r=(t[a]-n)*e/2,n=t[a],-r);return o}// plots a number of points along the segment as evenly as possible while retaining non-smooth (angled) anchors.
export function segmentToDistributedPoints(t,e){t.samples||T(t);// first, loop through each anchor and find out if it's smooth (curve) or not by comparing the angle to each control point (if they're within a certain range, it's smooth). We want to keep pivot points (non-smooth) anchors but allow curved/smooth ones to be subject to simplification.
for(var n,r,o,a,l,h,i,s,g,p,c,f,v,d,m=t.samples,x=t.lookup,P=t.resolution,L=t.totalLength,w=t.slice(0,2),b=[],S=t.length-4,R=6,N=0,k=0;R<S;R+=6)Math.abs(u(t[R+1]-t[R-1],t[R]-t[R-2])-u(t[R+3]-t[R+1],t[R+2]-t[R]))>.2&&b.push(R);// keep track of which points are non-smooth so that when we call pointsToSegment() we can maintain their angle.
if(b.push(t.length-2),// the last anchor is always a curve stopping point.
S=b.length,w.nonSmooth=f=[1],e>S)for(e-=S,l=0;l<S;l++){for(v=b[l],g=m[(d=Math.round(v/6*P))-1]-N,k+=r=Math.round(m[d-1]/L*e)-k,h=1/(r+1),i=1;i<=r;i++)p=N+g*i*h,o=(R=x.length?x[p<L?~~(p/t.minLength):x.length-1]||0:y(m,p,p/L))?m[R-1]:0,(a=m[R])<p&&(o=a,a=m[++R]),s=1-(n=1/P*((p-o)/(a-o)+R%P)||0),c=t[R=6*~~(R/P)],w.push(M((n*n*(t[R+6]-c)+3*s*(n*(t[R+4]-c)+s*(t[R+2]-c)))*n+c),// x
M((n*n*(t[R+7]-(c=t[R+1]))+3*s*(n*(t[R+5]-c)+s*(t[R+3]-c)))*n+c));f[w.length]=1,w.push(t[v],t[v+1]),N+=g}// if the path is closed (the last anchor is the same as the first), check to see if it's a smooth joint. If so, update the nonSmooth Array accordingly.
return R=t.length-2,t.closed&&Math.abs(u(t[R+1]-t[R-1],t[R]-t[R-2])-u(t[3]-t[1],t[2]-t[0]))<=.2&&(f[0]=f[f.length-1]=0),w}//points is an array of x/y points, like [x, y, x, y, x, y]
export function pointsToSegment(t,e){
//points = simplifyPoints(points, tolerance);
s(t[0]-t[2])<1e-4&&s(t[1]-t[3])<1e-4&&(t=t.slice(2));// if the first two points are super close, dump the first one.
var n,r,o,a,l,h,i,u,p,c,f,v,d,m,x=t.length-2,P=+t[0],L=+t[1],w=+t[2],y=+t[3],b=[P,L,P,L],S=w-P,R=y-L,N=t.nonSmooth||[],
// populated by segmentToDistributedPoints(). The x slot will have 1 if it's a non-smooth point, in which case we should skip the smoothing here, obviously.
T=Math.abs(t[x]-P)<.001&&Math.abs(t[x+1]-L)<.001;if(!x)return[P,L,P,L,P,L,P,L];for(T&&(
// if the start and end points are basically on top of each other, close the segment by adding the 2nd point to the end, and the 2nd-to-last point to the beginning (we'll remove them at the end, but this allows the curvature to look perfect)
t.push(w,y),w=P,y=L,P=t[x-2],L=t[x-1],t.unshift(P,L),x+=4,N=[0,0].concat(N)),e=e||0===e?+e:1,o=2;o<x;o+=2)n=P,r=L,P=w,L=y,w=+t[o+2],y=+t[o+3],P===w&&L===y||(a=S,l=R,S=w-P,R=y-L,N[o]?b.push(P-(P-n)/4,L-(L-r)/4,P,L,P+(w-P)/4,L+(y-L)/4):(u=((h=g(a*a+l*l))+(// r1, r2, and r3 correlate x and y (and z in the future). Basically 2D or 3D hypotenuse
i=g(S*S+R*R)))*e*.25/g(Math.pow(S/i+a/h,2)+Math.pow(R/i+l/h,2)),f=P-((p=P-(P-n)*(h?u/h:0))+(((c=P+(w-P)*(i?u/i:0))-p)*(3*h/(h+i)+.5)/4||0)),m=L-((v=L-(L-r)*(h?u/h:0))+(((d=L+(y-L)*(i?u/i:0))-v)*(3*h/(h+i)+.5)/4||0)),b.push(M(p+f),// first control point
M(v+m),M(P),// anchor
M(L),M(c+f),// second control point
M(d+m))));return P!==w||L!==y||b.length<4?b.push(M(w),M(y),M(w),M(y)):b.length-=2,2===b.length?
// only one point!
b.push(P,L,P,L,P,L):T&&(b.splice(0,6),b.length-=6),b.closed=T,b}//returns the squared distance between an x/y coordinate and a segment between x1/y1 and x2/y2
function A(t,e,n,r,o){var a,l,h,i,s,g,u,p,c,f,v,d,m=r,x=t[e],M=t[e+1],P=t[n],L=t[n+1];for(l=e+2;l<n;l+=2)i=t[l],s=t[l+1],f=void 0,v=void 0,d=void 0,d=(c=L)-(u=M),((v=(p=P)-(g=x))||d)&&((f=((i-g)*v+(s-u)*d)/(v*v+d*d))>1?(g=p,u=c):f>0&&(g+=v*f,u+=d*f)),(h=Math.pow(i-g,2)+Math.pow(s-u,2))>m&&(a=l,m=h);m>r&&(a-e>2&&A(t,e,a,r,o),o.push(t[a],t[a+1]),n-a>2&&A(t,a,n,r,o))}//points is an array of x/y values like [x, y, x, y, x, y]
export function simplifyPoints(t,e){var n,r,o,a,l,h,i,s=parseFloat(t[0]),g=parseFloat(t[1]),u=[s,g],p=t.length-2;for(e=Math.pow(e||1,2),n=2;n<p;n+=2)(a=s-(r=parseFloat(t[n])))*a+(l=g-(o=parseFloat(t[n+1])))*l>e&&(u.push(r,o),s=r,g=o);return u.push(parseFloat(t[p]),parseFloat(t[p+1])),A(u,0,i=u.length-2,e,h=[u[0],u[1]]),h.push(u[i],u[i+1]),h}function C(e,n,r,o,a,l,h,i,s,g,u,c,f,v){var d,m,x,M,P=(a-o)/l,L=0,w=o;for(t=p;w<=a;)(d=(m=(M=1-w)*M*M*h+3*M*M*w*s+3*M*w*w*u+w*w*w*f-n)*m+(x=M*M*M*i+3*M*M*w*g+3*M*w*w*c+w*w*w*v-r)*x)<t&&(t=d,L=w),w+=P;return e>1?C(e-1,n,r,Math.max(L-P,0),Math.min(L+P,1),l,h,i,s,g,u,c,f,v):L}export function getClosestData(e,n,r,o){
//returns an object with the closest j, i, and t (j is the segment index, i is the index of the point in that segment, and t is the time/progress along that bezier)
var a,l,h,i,s={j:0,i:0,t:0},g=p;for(l=0;l<e.length;l++)for(i=e[l],a=0;a<i.length;a+=6)h=C(1,n,r,0,1,o||20,i[a],i[a+1],i[a+2],i[a+3],i[a+4],i[a+5],i[a+6],i[a+7]),g>t&&(g=t,s.j=l,s.i=a,s.t=h);return s}//subdivide a Segment closest to a specific x,y coordinate
export function subdivideSegmentNear(e,n,r,o,a){var l,h,i=r.length,s=p,g=0,u=0;for(o=o||20,a=a||3,h=0;h<i;h+=6)l=C(1,e,n,0,1,o,r[h],r[h+1],r[h+2],r[h+3],r[h+4],r[h+5],r[h+6],r[h+7]),s>t&&(s=t,g=l,u=h);return subdivideSegment(r,u,l=C(a,e,n,g-.05,g+.05,o,r[u],r[u+1],r[u+2],r[u+3],r[u+4],r[u+5],r[u+6],r[u+7])),u+6}
/*
Takes any of the following and converts it to an all Cubic Bezier SVG data string:
- A <path> data string like "M0,0 L2,4 v20,15 H100"
- A RawPath, like [[x, y, x, y, x, y, x, y][[x, y, x, y, x, y, x, y]]
- A Segment, like [x, y, x, y, x, y, x, y]

Note: all numbers are rounded down to the closest 0.001 to minimize memory, maximize speed, and avoid odd numbers like 1e-13
*/export function rawPathToString(t){f(t[0])&&(
//in case a segment is passed in instead
t=[t]);var e,n,r,o,a="",l=t.length;for(n=0;n<l;n++){for(o=t[n],a+="M"+M(o[0])+","+M(o[1])+" C",e=o.length,r=2;r<e;r++)a+=M(o[r++])+","+M(o[r++])+" "+M(o[r++])+","+M(o[r++])+" "+M(o[r++])+","+M(o[r])+" ";o.closed&&(a+="z")}return a}
/*
// takes a segment with coordinates [x, y, x, y, ...] and converts the control points into angles and lengths [x, y, angle, length, angle, length, x, y, angle, length, ...] so that it animates more cleanly and avoids odd breaks/kinks. For example, if you animate from 1 o'clock to 6 o'clock, it'd just go directly/linearly rather than around. So the length would be very short in the middle of the tween.
export function cpCoordsToAngles(segment, copy) {
	var result = copy ? segment.slice(0) : segment,
		x, y, i;
	for (i = 0; i < segment.length; i+=6) {
		x = segment[i+2] - segment[i];
		y = segment[i+3] - segment[i+1];
		result[i+2] = Math.atan2(y, x);
		result[i+3] = Math.sqrt(x * x + y * y);
		x = segment[i+6] - segment[i+4];
		y = segment[i+7] - segment[i+5];
		result[i+4] = Math.atan2(y, x);
		result[i+5] = Math.sqrt(x * x + y * y);
	}
	return result;
}

// takes a segment that was converted with cpCoordsToAngles() to have angles and lengths instead of coordinates for the control points, and converts it BACK into coordinates.
export function cpAnglesToCoords(segment, copy) {
	var result = copy ? segment.slice(0) : segment,
		length = segment.length,
		rnd = 1000,
		angle, l, i, j;
	for (i = 0; i < length; i+=6) {
		angle = segment[i+2];
		l = segment[i+3]; //length
		result[i+2] = (((segment[i] + Math.cos(angle) * l) * rnd) | 0) / rnd;
		result[i+3] = (((segment[i+1] + Math.sin(angle) * l) * rnd) | 0) / rnd;
		angle = segment[i+4];
		l = segment[i+5]; //length
		result[i+4] = (((segment[i+6] - Math.cos(angle) * l) * rnd) | 0) / rnd;
		result[i+5] = (((segment[i+7] - Math.sin(angle) * l) * rnd) | 0) / rnd;
	}
	return result;
}

//adds an "isSmooth" array to each segment and populates it with a boolean value indicating whether or not it's smooth (the control points have basically the same slope). For any smooth control points, it converts the coordinates into angle (x, in radians) and length (y) and puts them into the same index value in a smoothData array.
export function populateSmoothData(rawPath) {
	let j = rawPath.length,
		smooth, segment, x, y, x2, y2, i, l, a, a2, isSmooth, smoothData;
	while (--j > -1) {
		segment = rawPath[j];
		isSmooth = segment.isSmooth = segment.isSmooth || [0, 0, 0, 0];
		smoothData = segment.smoothData = segment.smoothData || [0, 0, 0, 0];
		isSmooth.length = 4;
		l = segment.length - 2;
		for (i = 6; i < l; i += 6) {
			x = segment[i] - segment[i - 2];
			y = segment[i + 1] - segment[i - 1];
			x2 = segment[i + 2] - segment[i];
			y2 = segment[i + 3] - segment[i + 1];
			a = _atan2(y, x);
			a2 = _atan2(y2, x2);
			smooth = (Math.abs(a - a2) < 0.09);
			if (smooth) {
				smoothData[i - 2] = a;
				smoothData[i + 2] = a2;
				smoothData[i - 1] = _sqrt(x * x + y * y);
				smoothData[i + 3] = _sqrt(x2 * x2 + y2 * y2);
			}
			isSmooth.push(smooth, smooth, 0, 0, smooth, smooth);
		}
		//if the first and last points are identical, check to see if there's a smooth transition. We must handle this a bit differently due to their positions in the array.
		if (segment[l] === segment[0] && segment[l+1] === segment[1]) {
			x = segment[0] - segment[l-2];
			y = segment[1] - segment[l-1];
			x2 = segment[2] - segment[0];
			y2 = segment[3] - segment[1];
			a = _atan2(y, x);
			a2 = _atan2(y2, x2);
			if (Math.abs(a - a2) < 0.09) {
				smoothData[l-2] = a;
				smoothData[2] = a2;
				smoothData[l-1] = _sqrt(x * x + y * y);
				smoothData[3] = _sqrt(x2 * x2 + y2 * y2);
				isSmooth[l-2] = isSmooth[l-1] = true; //don't change indexes 2 and 3 because we'll trigger everything from the END, and this will optimize file size a bit.
			}
		}
	}
	return rawPath;
}
export function pointToScreen(svgElement, point) {
	if (arguments.length < 2) { //by default, take the first set of coordinates in the path as the point
		let rawPath = getRawPath(svgElement);
		point = svgElement.ownerSVGElement.createSVGPoint();
		point.x = rawPath[0][0];
		point.y = rawPath[0][1];
	}
	return point.matrixTransform(svgElement.getScreenCTM());
}
// takes a <path> and normalizes all of its coordinates to values between 0 and 1
export function normalizePath(path) {
  path = gsap.utils.toArray(path);
  if (!path[0].hasAttribute("d")) {
    path = gsap.utils.toArray(path[0].children);
  }
  if (path.length > 1) {
    path.forEach(normalizePath);
    return path;
  }
  let _svgPathExp = /[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/ig,
      _scientific = /[\+\-]?\d*\.?\d+e[\+\-]?\d+/ig,
      d = path[0].getAttribute("d"),
      a = d.replace(_scientific, m => { let n = +m; return (n < 0.0001 && n > -0.0001) ? 0 : n; }).match(_svgPathExp),
      nums = a.filter(n => !isNaN(n)).map(n => +n),
      normalize = gsap.utils.normalize(Math.min(...nums), Math.max(...nums)),
      finals = a.map(val => isNaN(val) ? val : normalize(+val)),
      s = "",
      prevWasCommand;
  finals.forEach((value, i) => {
    let isCommand = isNaN(value)
    s += (isCommand && i ? " " : prevWasCommand || !i ? "" : ",") + value;
    prevWasCommand = isCommand;
  });
  path[0].setAttribute("d", s);
}
*/