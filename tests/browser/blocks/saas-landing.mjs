import { check as checkRequests } from "../review/block-saas-landing-requests.mjs";
export async function check(context) {
  for (const theme of ["dark", "light"]) {
    const mount = code => context.mount(code.replaceAll("<Subject.SaasLanding", '<Subject.SaasLanding theme="' + theme + '" '));
    await checkRequests({ ...context, mount });
  }
}
