# DNS before changes

2026-09-12. User inspected Namecheap in their normal browser after the embedded login failed.

Registrar: Namecheap. Nameservers setting: Namecheap BasicDNS.

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | www | parkingpage.namecheap.com. | 30 minutes |
| URL Redirect | @ | http://www.neylo.xyz/ (unmasked) | N/A |
| TXT | @ | v=spf1 include:spf.efwd.registrar-servers.com ~all | Automatic |

Mail Settings: Email Forwarding. Actual active forwarding aliases have not been confirmed. Cloudflare's automatic scan found zero records. System DNS queries initially returned NXDOMAIN; this is not evidence of unpurchased ownership. No nameserver change is authorized solely by the scan.

Direct query to the current authoritative server `dns1.registrar-servers.com` succeeded and returned MX 10 eforward1/2/3.registrar-servers.com, MX 15 eforward4.registrar-servers.com, MX 20 eforward5.registrar-servers.com, all TTL 1800, and the same SPF TXT. These exact five MX records are included in the import. The new sender uses notify.neylo.xyz with a separate, non-enforcing DMARC policy, so it does not overwrite root mail policy.

Preserve email SPF and any existing forwarding/MX records; replace only default website parking records as part of the requested NEYLO website deployment. Cloudflare zone plan selected: Free, no subscription purchased. Cloudflare Workers custom domains require an active Cloudflare zone. Registration stays at Namecheap if the user approves the DNS delegation.
