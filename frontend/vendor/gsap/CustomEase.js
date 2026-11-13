/*!
 * CustomEase 3.15.0
 * https://gsap.com
 *
 * @license Copyright 2008-2026, GreenSock. All rights reserved.
 * Subject to the terms at https://gsap.com/standard-license
 * @author: Jack Doyle, jack@greensock.com
*/
/* eslint-disable */
import{stringToRawPath as t,rawPathToString as e,transformRawPath as n}from"./utils/paths.js";var s,i,a=function(){return s||"undefined"!=typeof window&&(s=window.gsap)&&s.registerPlugin&&s},r=function(){(s=a())?(s.registerEase("_CE",CustomEase.create),i=1):console.warn("Please gsap.registerPlugin(CustomEase)")},o=function(t){return~~(1e3*t+(t<0?-.5:.5))/1e3},
//<name>CustomEase</name>
u=/[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/gi,
//finds any numbers, including ones that start with += or -=, negative numbers, and ones in scientific notation like 1e-8.
c=/[cLlsSaAhHvVtTqQ]/g,
//note that this function returns point objects like {x, y} rather than working with segments which are arrays with alternating x, y values as in the similar function in paths.js
h=function t(e,n,s,i,a,r,o,u,c,h,x){var g,f=(e+s)/2,l=(n+i)/2,y=(s+a)/2,p=(i+r)/2,m=(a+o)/2,d=(r+u)/2,v=(f+y)/2,E=(l+p)/2,C=(y+m)/2,M=(p+d)/2,w=(v+C)/2,b=(E+M)/2,D=o-e,P=u-n,S=Math.abs((s-o)*P-(i-u)*D),V=Math.abs((a-o)*P-(r-u)*D);return h||(h=[{x:e,y:n},{x:o,y:u}],x=1),h.splice(x||h.length-1,0,{x:w,y:b}),(S+V)*(S+V)>c*(D*D+P*P)&&(g=h.length,t(e,n,f,l,v,E,w,b,c,h,x),t(w,b,C,M,m,d,o,u,c,h,x+1+(h.length-g))),h};export var CustomEase=function(){function a(t,e,n){i||r(),this.id=t,this.setData(e,n)}var x=a.prototype;return x.setData=function(e,n){n=n||{};var i,a,r,o,x,g,f,l,y,p=(e=e||"0,0,1,1").match(u),m=1,d=[],v=[],E=n.precision||1,C=E<=1;if(this.data=e,(c.test(e)||~e.indexOf("M")&&e.indexOf("C")<0)&&(p=t(e)[0]),4===(i=p.length))p.unshift(0,0),p.push(1,1),i=8;else if((i-2)%6)throw"Invalid CustomEase";for(0==+p[0]&&1==+p[i-2]||function(t,e,n){n||0===n||(n=Math.max(+t[t.length-1],+t[1]));var s,i=-1*+t[0],a=-n,r=t.length,o=1/(+t[r-2]+i),u=-e||(Math.abs(+t[r-1]-+t[1])<.01*(+t[r-2]-+t[0])?function(t){var e,n=t.length,s=1e20;for(e=1;e<n;e+=6)+t[e]<s&&(s=+t[e]);return s}(t)+a:+t[r-1]+a);for(
//typically y ends at 1 (so that the end values are reached)
u=u?1/u:-o,s=0;s<r;s+=2)t[s]=(+t[s]+i)*o,t[s+1]=(+t[s+1]+a)*u}(p,n.height,n.originY),this.segment=p,o=2;o<i;o+=6)a={x:+p[o-2],y:+p[o-1]},r={x:+p[o+4],y:+p[o+5]},d.push(a,r),h(a.x,a.y,+p[o],+p[o+1],+p[o+2],+p[o+3],r.x,r.y,1/(2e5*E),d,d.length-1);for(i=d.length,o=0;o<i;o++)f=d[o],l=d[o-1]||f,(f.x>l.x||l.y!==f.y&&l.x===f.x||f===l)&&f.x<=1?(
//if a point goes BACKWARD in time or is a duplicate, just drop it. Also it shouldn't go past 1 on the x axis, as could happen in a string like "M0,0 C0,0 0.12,0.68 0.18,0.788 0.195,0.845 0.308,1 0.32,1 0.403,1.005 0.398,1 0.5,1 0.602,1 0.816,1.005 0.9,1 0.91,1 0.948,0.69 0.962,0.615 1.003,0.376 1,0 1,0".
l.cx=f.x-l.x,//change in x between this point and the next point (performance optimization)
l.cy=f.y-l.y,l.n=f,l.nx=f.x,//next point's x value (performance optimization, making lookups faster in getRatio()). Remember, the lookup will always land on a spot where it's either this point or the very next one (never beyond that)
C&&o>1&&Math.abs(l.cy/l.cx-d[o-2].cy/d[o-2].cx)>2&&(
//if there's a sudden change in direction, prioritize accuracy over speed. Like a bounce ease - you don't want to risk the sampling chunks landing on each side of the bounce anchor and having it clipped off.
C=0),l.cx<m&&(l.cx?m=l.cx:(l.cx=.001,//avoids math problems in getRatio() (dividing by zero)
o===i-1&&(
//in case the final segment goes vertical RIGHT at the end, make sure we end at the end.
l.x-=.001,m=Math.min(m,.001),C=0)))):(d.splice(o--,1),i--);if(x=1/(i=1/m+1|0),g=0,f=d[0],C){for(o=0;o<i;o++)
//for fastest lookups, we just sample along the path at equal x (time) distance. Uses more memory and is slightly less accurate for anchors that don't land on the sampling points, but for the vast majority of eases it's excellent (and fast).
y=o*x,f.nx<y&&(f=d[++g]),a=f.y+(y-f.x)/f.cx*f.cy,v[o]={x:y,cx:x,y:a,cy:0,nx:9},o&&(v[o-1].cy=a-v[o-1].y);g=d[d.length-1],v[i-1].cy=g.y-a,v[i-1].cx=g.x-v[v.length-1].x}else{
//this option is more accurate, ensuring that EVERY anchor is hit perfectly. Clipping across a bounce, for example, would never happen.
for(o=0;o<i;o++)
//build a lookup table based on the smallest distance so that we can instantly find the appropriate point (well, it'll either be that point or the very next one). We'll look up based on the linear progress. So it's it's 0.5 and the lookup table has 100 elements, it'd be like lookup[Math.floor(0.5 * 100)]
f.nx<o*x&&(f=d[++g]),v[o]=f;g<d.length-1&&(v[o-1]=d[d.length-2])}//this._calcEnd = (points[points.length-1].y !== 1 || points[0].y !== 0); //ensures that we don't run into floating point errors. As long as we're starting at 0 and ending at 1, tell GSAP to skip the final calculation and use 0/1 as the factor.
return this.ease=function(t){var e=v[t*i|0]||v[i-1];return e.nx<t&&(e=e.n),e.y+(t-e.x)/e.cx*e.cy},this.ease.custom=this,this.id&&s&&s.registerEase(this.id,this.ease),this},x.getSVGData=function(t){return a.getSVGData(this,t)},a.create=function(t,e,n){return new a(t,e,n).ease},a.register=function(t){s=t,r()},a.get=function(t){return s.parseEase(t)},a.getSVGData=function(t,i){var r,u,c,h,x,g,f,l,y,p,m=(i=i||{}).width||100,d=i.height||100,v=i.x||0,E=(i.y||0)+d,C=s.utils.toArray(i.path)[0];if(i.invert&&(d=-d,E=0),"string"==typeof t&&(t=s.parseEase(t)),t.custom&&(t=t.custom),t instanceof a)r=e(n([t.segment.slice(0)],m,0,0,-d,v,E));else{for(r=[v,E],h=1/(f=Math.max(5,200*(i.precision||1))),l=5/(f+=2),y=o(v+h*m),u=((p=o(E+t(h)*-d))-E)/(y-v),c=2;c<f;c++)x=o(v+c*h*m),g=o(E+t(c*h)*-d),(Math.abs((g-p)/(x-y)-u)>l||c===f-1)&&(
//only add points when the slope changes beyond the threshold
r.push(y,p),u=(g-p)/(x-y)),y=x,p=g;r="M"+r.join(",")}return C&&C.setAttribute("d",r),r},a}();CustomEase.version="3.15.0",CustomEase.headless=!0,a()&&s.registerPlugin(CustomEase);export{CustomEase as default};