export const GA_ID = "G-8Y3XJHBHPB";

export const CONSENT_KEY = "analytics-consent";

export type Consent = "granted" | "denied";

/**
 * Inline head script: defines window.clauseAnalytics, which loads the Google
 * tag (gtag.js), and calls it at once when the visitor has accepted analytics
 * cookies. Without consent nothing is loaded and no cookie is set.
 */
export const analyticsInitScript = `(function(){
window.clauseAnalytics=function(){if(window.gtag)return;
var s=document.createElement("script");s.async=true;
s.src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
document.head.appendChild(s);
window.dataLayer=window.dataLayer||[];
window.gtag=function(){dataLayer.push(arguments)};
gtag("js",new Date());gtag("config","${GA_ID}")};
var c;try{c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)})}catch(e){}
if(c==="granted")window.clauseAnalytics()})()`;
