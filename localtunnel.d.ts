declare module "localtunnel" {
  import { EventEmitter } from "events";

  interface TunnelOptions {
    port: number;
    subdomain?: string;
    host?: string;
    local_host?: string;
    local_https?: boolean;
    local_cert?: string;
    local_key?: string;
    local_ca?: string;
    allow_invalid_cert?: boolean;
  }

  interface Tunnel extends EventEmitter {
    url: string;
    close(): void;
  }

  function localtunnel(opts: TunnelOptions): Promise<Tunnel>;
  export default localtunnel;
}
