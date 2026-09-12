'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RefreshCw,ArrowLeft } from 'lucide-react';
import { request } from '@/lib/client';
import { registeredAccountsSchema,type RegisteredAccounts } from './accounts-domain';

export function RegisteredAccountsView({initial}:{initial:RegisteredAccounts}){
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[cohort,setCohort]=useState('all'),[page,setPage]=useState(1);
  const params=new URLSearchParams({search:query,cohort,page:String(page)});
  const {data,error,mutate,isValidating}=useSWR(`admin/accounts?${params}`,path=>request(path,registeredAccountsSchema),{fallbackData:initial,keepPreviousData:false,refreshInterval:30000,refreshWhenHidden:false});
  const matches=data?.search===query&&data.cohort===cohort&&data.page===page;
  const pages=data?Math.max(1,Math.ceil(data.total/data.pageSize)):1;
  return <main id="main" className="dashboard registered-accounts">
    <Link className="inline-link" href="/admin/validation"><ArrowLeft size={15}/>Validation dashboard</Link>
    <div className="dashboard-heading"><div><p className="eyebrow">PRIVATE · OPERATOR ONLY</p><h1>Registered accounts.</h1><p className="small-copy">Verified emails belonging to completed NEYLO accounts. Contact details never appear in Judge Mode.</p></div></div>
    <form className="dashboard-filters accounts-filters" onSubmit={event=>{event.preventDefault();setQuery(search.trim().replace(/^@/,''));setPage(1);}}>
      <label>Search email or handle<input type="search" value={search} maxLength={254} onChange={event=>setSearch(event.target.value)} autoComplete="off" placeholder="Email or @handle"/></label>
      <button className="button secondary" type="submit">Search</button>
      <label>Cohort<select value={cohort} onChange={event=>{setCohort(event.target.value);setPage(1);}}><option value="all">All accounts · includes staff/tests</option><option value="participants">Participants · staff/tests excluded</option><option value="independent">Independent participants</option><option value="founder_assisted">Founder-assisted participants</option><option value="staff">Staff</option><option value="test">Test accounts</option><option value="compensated">Compensated research</option></select></label>
      <button className="icon-button" type="button" aria-label="Refresh accounts" onClick={()=>mutate()}><RefreshCw size={18} className={isValidating?'refreshing':''}/></button>
    </form>
    <p className={error?'form-error':'dashboard-freshness'} role="status">{error?'Could not refresh accounts. Retry to load current records.':!matches?'Loading accounts…':`${data.total} verified completed ${data.total===1?'account':'accounts'}${isValidating?' · Refreshing…':''}`}</p>
    {matches&&<><div className="accounts-table-wrap" tabIndex={0} role="region" aria-label="Registered accounts table, scroll horizontally on small screens"><table className="accounts-table"><thead><tr><th>Handle</th><th>Verified email</th><th>Completed (UTC)</th><th>Cohort</th><th>Source</th></tr></thead><tbody>{data.accounts.length?data.accounts.map(account=><tr key={account.id}><th scope="row">@{account.handle}</th><td className="account-email">{account.email}</td><td><time dateTime={account.completedAt}>{new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(account.completedAt))}</time></td><td><span className={`cohort-label cohort-${account.cohort}`}>{account.cohort.replaceAll('_',' ')}</span></td><td>{account.source}</td></tr>):<tr><td colSpan={5}>No completed accounts match this search.</td></tr>}</tbody></table></div>
      <div className="accounts-pagination"><button className="button secondary" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {pages}</span><button className="button secondary" disabled={page>=pages} onClick={()=>setPage(value=>value+1)}>Next</button></div>
      <p className="small-copy">Incomplete reservations and unverified identities are excluded. Staff and tests are labeled separately; choose Participants to see acquisition accounts.</p></>}
  </main>;
}
