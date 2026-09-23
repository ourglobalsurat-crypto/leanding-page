/* Leadgen public write-only connector. Use from a browser or a fetch-enabled server.
 * Supply the ONE hosted form link from Settings > Website Leads.
 * This is not a CRM login key. Never put an admin credential in your landing page.
 */
export function createLeadClient(formLink) {
  const url=new URL(formLink);
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if ((url.protocol!=='https:' && !(local && url.protocol==='http:')) || url.username || url.password
      || !url.pathname.endsWith('/website-form.php') || !/^ws_(?:main|[a-f0-9]{16})\.[a-f0-9]{48}$/.test(url.searchParams.get('form') || '')) {
    throw new Error('Use the complete enquiry link copied from Leadgen Website Leads settings.');
  }
  const endpoint=new URL('website-leads.php',url);
  endpoint.searchParams.set('form',url.searchParams.get('form'));
  let last=null;
  async function request(method,origin,data) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try {
      const headers={Accept:'application/json'};
      // Browsers set Origin themselves. Server integrations supply their configured site origin.
      if (typeof window==='undefined') headers.Origin=origin;
      if(data)headers['Content-Type']='application/json';
      const response=await fetch(endpoint,{method,headers,credentials:'omit',redirect:'error',
        referrerPolicy:'no-referrer',signal:controller.signal,...(data?{body:JSON.stringify(data)}:{})});
      const result=await response.json();
      if(!response.ok || result.ok!==true)throw new Error(result.error || 'CRM did not accept the enquiry.');
      return result;
    } catch(error) {
      if(error.name==='AbortError' || error instanceof TypeError || error instanceof SyntaxError)
        throw new Error('CRM receipt could not be confirmed. Keep the enquiry and retry with the same request ID.');
      throw error;
    } finally {clearTimeout(timer);}
  }
  return {
    async submit(lead,options={}) {
      if(!lead || typeof lead!=='object' || Array.isArray(lead))throw new Error('Provide the enquiry fields.');
      const browser=typeof window!=='undefined';
      const origin=new URL(browser?window.location.origin:options.origin).origin;
      let page=options.pageUrl || (browser?window.location.href:origin+'/');
      const pageUrl=new URL(page);
      if(pageUrl.origin!==origin)throw new Error('The enquiry page must belong to the configured website origin.');
      const payload={name:lead.name,phone:lead.phone,email:lead.email || '',message:lead.message || '',
        fields:lead.fields || {},gclid:lead.gclid || '',company_website:lead.company_website || '',page_url:origin+pageUrl.pathname};
      if(typeof payload.name!=='string' || !payload.name.trim() || typeof payload.phone!=='string' || !payload.phone.trim())
        throw new Error('Map the customer name and phone number before sending the enquiry.');
      const fingerprint=JSON.stringify([origin,payload,options.requestId || '']);
      if(last?.fingerprint===fingerprint && last.promise)return last.promise;
      if(!last || last.fingerprint!==fingerprint)last={fingerprint,id:options.requestId || globalThis.crypto.randomUUID()};
      const attempt=last;
      if(!/^[a-zA-Z0-9-]{20,80}$/.test(attempt.id))throw new Error('Use a stable request ID of 20 to 80 letters, numbers or hyphens.');
      attempt.promise=(async()=>{
        try {
          const config=await request('GET',origin);
          const result=await request('POST',origin,{...payload,request_id:attempt.id,challenge:config.form.challenge});
          if(last===attempt)last=null;
          return result;
        } finally {attempt.promise=null;}
      })();
      return attempt.promise;
    }
  };
}
