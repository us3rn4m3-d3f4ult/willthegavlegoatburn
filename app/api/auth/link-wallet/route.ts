import { publicClient } from "@/lib/web3";
import { verifyMessage } from "viem";
import { crossOrigin } from "@/lib/auth";
import { json, readJson } from "@/lib/httpx";
import { sessionUser } from "@/lib/session";
import { addressTaken, linkMessage, setLinkedWallet } from "@/lib/walletLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x[0-9a-fA-F]+$/;
const MAX_AGE_MS = 10 * 60_000;

/**
 * Links a wallet to the account, proven by a signature. The address is public,
 * the key stays on the device, and nothing here can move funds.
 *
 * Two kinds of wallet are accepted:
 *
 *  - an EOA, signed with `personal_sign` and checked with the usual ECDSA
 *    recovery;
 *  - a smart account (the passkey Safe), whose signature is validated on-chain
 *    through ERC-1271. If the account is not deployed yet the client also sends
 *    `factory` + `factoryData`, and viem verifies it as an ERC-6492 signature.
 */
export async function POST(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  const body = await readJson<{
    address?: string;
    signature?: string;
    issued?: string;
    factory?: string;
    factoryData?: string;
  }>(req);
  if (!body) return json({ ok: false, error: "invalid_body" }, 400);

  const address = String(body.address ?? "");
  const signature = String(body.signature ?? "");
  const issued = String(body.issued ?? "");
  const factory = body.factory ? String(body.factory) : "";
  const factoryData = body.factoryData ? String(body.factoryData) : "";

  if (!ADDRESS.test(address)) return json({ ok: false, error: "bad_address" }, 400);
  if (!HEX.test(signature)) return json({ ok: false, error: "bad_signature" }, 400);

  // A signature is only good for one account and a short window: the message
  // carries both, so it cannot be replayed elsewhere later.
  const age = Math.abs(Date.now() - new Date(issued).getTime());
  if (!Number.isFinite(age) || age > MAX_AGE_MS) {
    return json({ ok: false, error: "expired" }, 400);
  }

  const message = linkMessage(user.id, address, issued);
  let valid = false;

  // EOA path first: this is what a browser extension wallet produces.
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }

  // Smart-account path: on-chain isValidSignature (ERC-1271), and with the
  // counterfactual factory call when the account is still undeployed (ERC-6492).
  if (!valid) {
    try {
      const smart =
        ADDRESS.test(factory) && factoryData && HEX.test(factoryData)
          ? { factory: factory as `0x${string}`, factoryData: factoryData as `0x${string}` }
          : {};
      valid = await publicClient.verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
        ...smart,
      });
    } catch {
      valid = false;
    }
  }

  if (!valid) return json({ ok: false, error: "bad_signature" }, 400);

  if (await addressTaken(address, user.id)) {
    return json({ ok: false, error: "already_linked" }, 409);
  }

  await setLinkedWallet(user.id, address);
  return json({ ok: true, wallet: address });
}

/** Removes the link. Positions stay on the blockchain, only the display changes. */
export async function DELETE(req: Request) {
  if (crossOrigin(req)) return json({ ok: false, error: "bad_origin" }, 403);

  const user = await sessionUser(req);
  if (!user) return json({ ok: false, error: "sign_in_required" }, 401);

  await setLinkedWallet(user.id, null);
  return json({ ok: true, wallet: null });
}
