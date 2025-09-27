import { useMemo, useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CETH_ABI, CETH_ADDRESS } from '../config/contracts';
import { useAccount, usePublicClient } from 'wagmi';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

export function LottoApp() {
  const { address, isConnected } = useAccount();
  const viemClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance: zama, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [roundId, setRoundId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [priceWei, setPriceWei] = useState<bigint | null>(null);
  const [ownerAddr, setOwnerAddr] = useState<string | null>(null);
  const [digits, setDigits] = useState([1, 1, 1, 1]);
  const [winners, setWinners] = useState<Array<{ round: number; digits: [number, number, number, number] }>>([]);
  const [txStatus, setTxStatus] = useState<string>('');
  const [myTickets, setMyTickets] = useState<Array<{ round: number; index: number; d1: string; d2: string; d3: string; d4: string; clear?: [number, number, number, number] | null; loading?: boolean; error?: string | null }>>([]);
  const [cethBalance, setCethBalance] = useState<{ handle?: string | null; clear?: string | null; decimals?: number } | null>({ handle: null, clear: null, decimals: 18 });

  const publicClient = useMemo(() => {
    // Ensure no localhost usage; use Sepolia RPC from the injected wagmi client
    if (viemClient) return viemClient;
    return createPublicClient({ chain: sepolia, transport: http() });
  }, [viemClient]);

  async function refresh() {
    try {
      const [rid, open, p, own] = await Promise.all([
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'getCurrentRoundId',
          args: [],
        }),
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'isOpen',
          args: [],
        }),
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'TICKET_PRICE',
          args: [],
        }),
        publicClient.readContract({
          abi: CONTRACT_ABI as any,
          address: CONTRACT_ADDRESS as `0x${string}`,
          functionName: 'owner',
          args: [],
        }),
      ]);
      setRoundId(Number(rid));
      setIsOpen(Boolean(open));
      setPriceWei(p as bigint);
      setOwnerAddr((own as string) ?? null);
      // Load past winners (rounds 1..rid-1)
      const rnum = Number(rid);
      const wins: Array<{ round: number; digits: [number, number, number, number] }> = [];
      for (let r = 1; r < rnum; r++) {
        try {
          const res = await publicClient.readContract({
            abi: CONTRACT_ABI as any,
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'getWinningDigits',
            args: [BigInt(r)],
          });
          const arr = res as unknown as [bigint, bigint, bigint, bigint];
          wins.push({ round: r, digits: [Number(arr[0]), Number(arr[1]), Number(arr[2]), Number(arr[3])] });
        } catch (_) {}
      }
      setWinners(wins.reverse()); // latest first
      if (address) {
        // Fetch user's tickets across all rounds [1..rid]
        const all: Array<{ round: number; index: number; d1: string; d2: string; d3: string; d4: string }> = [];
        for (let r = 1; r <= Number(rid); r++) {
          const res = await publicClient.readContract({
            abi: CONTRACT_ABI as any,
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: 'getUserTickets',
            args: [BigInt(r), address as `0x${string}`],
          });
          const [a, b, c, d, idxs] = res as any[];
          for (let i = 0; i < (a?.length || 0); i++) {
            all.push({ round: r, index: Number(idxs[i]), d1: a[i], d2: b[i], d3: c[i], d4: d[i] });
          }
        }
        setMyTickets(all);

        // Fetch confidential cETH balance handle
        try {
          const [balHandle, decs] = await Promise.all([
            publicClient.readContract({
              abi: CETH_ABI as any,
              address: CETH_ADDRESS as `0x${string}`,
              functionName: 'confidentialBalanceOf',
              args: [address as `0x${string}`],
            }),
            publicClient.readContract({
              abi: CETH_ABI as any,
              address: CETH_ADDRESS as `0x${string}`,
              functionName: 'decimals',
              args: [],
            })
          ]);
          setCethBalance({ handle: balHandle as string, clear: null, decimals: Number(decs as number) });
        } catch (_) {
          setCethBalance({ handle: null, clear: null, decimals: 18 });
        }
      } else {
        setMyTickets([]);
        setCethBalance({ handle: null, clear: null, decimals: 18 });
      }
    } catch (e) {
      // noop
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function buyTicket() {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError || priceWei === null) return;
    // Digits are allowed 0-9 as per spec
    setTxStatus('Encrypting...');
    const buffer = zama.createEncryptedInput(CONTRACT_ADDRESS, address!);
    buffer.add8(BigInt(digits[0]));
    buffer.add8(BigInt(digits[1]));
    buffer.add8(BigInt(digits[2]));
    buffer.add8(BigInt(digits[3]));
    const { handles, inputProof } = await buffer.encrypt();

    setTxStatus('Submitting transaction...');
    const signer = await signerPromise!;
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, signer);
    const tx = await c.buyTicket(
      handles[0],
      handles[1],
      handles[2],
      handles[3],
      inputProof,
      { value: priceWei }
    );
    await tx.wait();
    setTxStatus('Ticket purchased.');
    await refresh();
  }

  function randomizeDigits() {
    const rnd = () => Math.floor(Math.random() * 10);
    setDigits([rnd(), rnd(), rnd(), rnd()]);
  }

  async function decryptTicket(ti: { round: number; index: number; d1: string; d2: string; d3: string; d4: string }) {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError || !address) return;
    const signer = await signerPromise!;
    const start = Math.floor(Date.now() / 1000).toString();
    const durationDays = '7';
    try {
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, loading: true, error: null } : t)));

      const keypair = zama.generateKeypair();
      const eip712 = zama.createEIP712(keypair.publicKey, [CONTRACT_ADDRESS], start, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: (eip712 as any).types.UserDecryptRequestVerification },
        eip712.message,
      );

      const pairs = [
        { handle: ti.d1, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d2, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d3, contractAddress: CONTRACT_ADDRESS },
        { handle: ti.d4, contractAddress: CONTRACT_ADDRESS },
      ];
      const out = await zama.userDecrypt(pairs, keypair.privateKey, keypair.publicKey, signature, [CONTRACT_ADDRESS], address, start, durationDays);
      const values = [ti.d1, ti.d2, ti.d3, ti.d4].map((h) => Number((out as any)[h] ?? 0));
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, clear: values as any, loading: false } : t)));
    } catch (err: any) {
      setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, loading: false, error: err?.message || 'Decrypt failed' } : t)));
    }
  }

  async function adminDraw() {
    if (!isConnected || !signerPromise) return;
    setTxStatus('Closing round and drawing (random)...');
    const signer = await signerPromise!;
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, signer);
    const tx = await c.closeAndDrawRandom();
    await tx.wait();
    setTxStatus('Round closed. New round opened. Players can claim.');
    await refresh();
  }

  async function claimTicket(ti: { round: number; index: number }) {
    if (!isConnected || !signerPromise) return;
    setTxStatus(`Claiming reward for round ${ti.round}, ticket ${ti.index}...`);
    const signer = await signerPromise!;
    const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI as any, signer);
    const tx = await c.claim(BigInt(ti.round), BigInt(ti.index));
    await tx.wait();
    setTxStatus('Claim submitted. cETH minted (confidentially).');
    // mark claimed locally
    setMyTickets((prev) => prev.map((t) => (t.round === ti.round && t.index === ti.index ? { ...t, claimed: true } as any : t)) as any);
  }

  async function decryptCethBalance() {
    if (!isConnected || !signerPromise || !zama || zamaLoading || zamaError || !address || !cethBalance?.handle) return;
    try {
      const signer = await signerPromise!;
      const start = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const keypair = zama.generateKeypair();
      const eip712 = zama.createEIP712(keypair.publicKey, [CETH_ADDRESS], start, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: (eip712 as any).types.UserDecryptRequestVerification },
        eip712.message,
      );
      const pairs = [ { handle: cethBalance.handle, contractAddress: CETH_ADDRESS } ];
      const out = await zama.userDecrypt(pairs, keypair.privateKey, keypair.publicKey, signature, [CETH_ADDRESS], address, start, durationDays);
      const raw = Number((out as any)[cethBalance.handle] ?? 0);
      const decs = cethBalance.decimals ?? 18;
      // format with decimals
      const scaled = BigInt(raw);
      const denominator = BigInt(10) ** BigInt(decs);
      const whole = scaled / denominator;
      const frac = scaled % denominator;
      const fracStr = frac.toString().padStart(decs, '0').replace(/0+$/, '');
      const formatted = fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
      setCethBalance({ ...cethBalance, clear: formatted });
    } catch (err) {
      // ignore
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--gray-50) 0%, var(--primary-50) 100%)' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--gray-200)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-4) var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--gradient-lottery)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: '800',
                color: 'white',
                boxShadow: 'var(--shadow-lg)'
              }}>
                🎲
              </div>
              <div>
                <h1 className="gradient-text" style={{
                  margin: 0,
                  fontSize: '1.875rem',
                  fontWeight: '800',
                  letterSpacing: '-0.025em'
                }}>
                  CryptoLotto
                </h1>
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: 'var(--gray-600)',
                  fontWeight: '500'
                }}>
                  Decentralized Lottery on Blockchain
                </p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Advantages */}
      <section className="card" style={{ maxWidth: '1200px', margin: 'var(--space-6) auto 0', padding: 'var(--space-6)' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--gray-900)' }}>Why CryptoLotto</h3>
        <ul style={{ margin: 'var(--space-3) 0 0 1.25rem', color: 'var(--gray-700)', fontSize: '0.95rem' }}>
          <li>Fully encrypted tickets on-chain with Zama FHE</li>
          <li>On-chain random draws, round-based lifecycle</li>
          <li>Position-specific matching and fixed cETH prizes</li>
          <li>Confidential claiming: mint occurs even for zero prizes</li>
        </ul>
      </section>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        {/* Hero Section with Current Round Info */}
        <section className="card sparkle" style={{
          padding: 'var(--space-8)',
          marginBottom: 'var(--space-8)',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h2 style={{
              fontSize: '2.25rem',
              fontWeight: '800',
              margin: '0 0 var(--space-2) 0',
              color: 'var(--gray-900)'
            }}>
              Current Round
            </h2>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--gray-600)',
              margin: 0
            }}>
              Your chance to win big starts here
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-6)',
            textAlign: 'center'
          }}>
            <div style={{
              padding: 'var(--space-6)',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid rgba(239, 68, 68, 0.2)'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Round Number
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary-600)' }}>
                #{roundId ?? '-'}
              </div>
            </div>

            <div style={{
              padding: 'var(--space-6)',
              background: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              borderRadius: 'var(--radius-xl)',
              border: `2px solid ${isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)'}`
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Status
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                color: isOpen ? 'var(--success)' : 'var(--gray-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)'
              }}>
                <span>{isOpen ? '🟢' : '🔴'}</span>
                {isOpen ? 'Open' : 'Closed'}
              </div>
            </div>

            <div style={{
              padding: 'var(--space-6)',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid rgba(245, 158, 11, 0.2)'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Ticket Price
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-600)' }}>
                {priceWei !== null ? `${formatEther(priceWei)} ETH` : '-'}
              </div>
            </div>
          </div>

          {/* Contract Address */}
          <div style={{
            marginTop: 'var(--space-6)',
            textAlign: 'center',
            padding: 'var(--space-4)',
            background: 'rgba(15, 23, 42, 0.05)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--gray-200)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--gray-500)', marginBottom: 'var(--space-1)' }}>
              Smart Contract
            </div>
            <code style={{
              fontSize: '0.875rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              color: 'var(--gray-700)',
              wordBreak: 'break-all'
            }}>
              {CONTRACT_ADDRESS}
            </code>
          </div>
        </section>

        {/* Game Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-8)'
        }}>
          {/* Buy Ticket */}
          <section className="card" style={{ padding: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '2rem' }}>🎫</div>
              <h3 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--gray-900)'
              }}>
                Buy Your Lucky Ticket
              </h3>
            </div>

            <p style={{
              color: 'var(--gray-600)',
              marginBottom: 'var(--space-6)',
              fontSize: '0.875rem'
            }}>
              Choose your lucky numbers (1-9 for each digit)
            </p>

            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
              justifyContent: 'center'
            }}>
              {digits.map((v, i) => (
                <div key={i} className="lottery-ball" style={{
                  animation: `float 3s ease-in-out infinite ${i * 0.2}s`,
                  position: 'relative'
                }}>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={v}
                    onChange={(e) => {
                      const next = [...digits];
                      const nv = Math.max(1, Math.min(9, Number(e.target.value || 1)));
                      next[i] = nv;
                      setDigits(next);
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      textAlign: 'center',
                      borderRadius: '50%'
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <button className="btn btn-secondary" onClick={randomizeDigits}>
                🎲 Random
              </button>
            </div>

            <button
              className={`btn btn-primary ${!isConnected || !isOpen || priceWei === null ? '' : 'sparkle'}`}
              onClick={buyTicket}
              disabled={!isConnected || !isOpen || priceWei === null}
              style={{
                width: '100%',
                padding: 'var(--space-4) var(--space-6)',
                fontSize: '1rem',
                fontWeight: '700'
              }}
            >
              🎲 Buy Ticket ({priceWei !== null ? `${formatEther(priceWei)} ETH` : '...'})
            </button>
          </section>

          {/* My cETH */}
          <section className="card" style={{ padding: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '2rem' }}>🪙</div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'var(--gray-900)' }}>My cETH</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--gray-800)' }}>
                {cethBalance?.clear ? `${cethBalance.clear} cETH` : '*** cETH'}
              </div>
              {!cethBalance?.clear && cethBalance?.handle && (
                <button className="btn btn-accent" onClick={decryptCethBalance}>Decrypt</button>
              )}
            </div>

            <div>cETH is Confidential ETH. It's wrapped from ETH. You can swap it to ETH. </div>
            <div>Lotto reward is cETH to secure confidential. No one will know how much you earn, even the platform know nothing.</div>
          </section>

          {/* Admin Draw (Random) */}
          <section className="card" style={{ padding: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '2rem' }}>⚡</div>
              <h3 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700',
                color: 'var(--gray-900)'
              }}>
                Admin Draw (Random)
              </h3>
            </div>

            <button
              className="btn btn-secondary"
              onClick={adminDraw}
              disabled={
                !isConnected ||
                !isOpen ||
                !address ||
                (ownerAddr !== null && ownerAddr.toLowerCase() !== (address as string).toLowerCase())
              }
              style={{
                width: '100%',
                padding: 'var(--space-4) var(--space-6)',
                fontSize: '1rem',
                fontWeight: '700'
              }}
            >
              ⚡ Close & Draw (Random)
            </button>
            {isConnected && isOpen && ownerAddr && address && ownerAddr.toLowerCase() !== address.toLowerCase() && (
              <div style={{ marginTop: 'var(--space-3)', color: 'var(--error)', fontSize: '0.8125rem' }}>
                Admin draw the boll on chain total randomly.
              </div>
            )}
          </section>
        </div>

        {/* Transaction Status */}
        {txStatus && (
          <div className="card" style={{
            padding: 'var(--space-4) var(--space-6)',
            marginBottom: 'var(--space-8)',
            background: 'linear-gradient(135deg, var(--secondary-50) 0%, var(--primary-50) 100%)',
            border: '2px solid var(--secondary-200)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: '1.5rem' }}>ℹ️</div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--gray-700)'
              }}>
                {txStatus}
              </div>
            </div>
          </div>
        )}

        {/* Round Results */}
        <section className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: '2rem' }}>🏆</div>
            <h3 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'var(--gray-900)'
            }}>
              Round Results
            </h3>
          </div>
          {winners.length === 0 ? (
            <div style={{
              padding: 'var(--space-6)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--gray-300)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>🗓️</div>
              <p style={{ color: 'var(--gray-600)', margin: 0, fontSize: '0.875rem' }}>
                No past round results yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {winners.map((w) => (
                <div key={w.round} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Round #{w.round}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {w.digits.map((num, i) => (
                      <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gradient-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Tickets */}
        <section className="card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <div style={{ fontSize: '2rem' }}>🎟️</div>
            <h3 style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'var(--gray-900)'
            }}>
              My Tickets
            </h3>
          </div>

          {myTickets.length === 0 ? (
            <div style={{
              padding: 'var(--space-8)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--gray-300)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>🎫</div>
              <p style={{
                color: 'var(--gray-600)',
                margin: 0,
                fontSize: '1rem',
                fontWeight: '500'
              }}>
                No tickets yet. Buy your first ticket to get started!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {myTickets.map((t) => (
                <div
                  key={`${t.round}-${t.index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4)',
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--gray-200)'
                  }}
                >
                  <div style={{
                    minWidth: '120px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)'
                  }}>
                    Round #{t.round}
                  </div>
                  <div style={{
                    minWidth: '100px',
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)'
                  }}>
                    Index {t.index}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1 }}>
                    {(t.clear ? t.clear : ['*','*','*','*']).map((v: any, i) => (
                      <div
                        key={i}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: t.clear ? 'var(--gradient-accent)' : 'var(--gray-200)',
                          color: t.clear ? 'var(--gray-800)' : 'var(--gray-600)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '0.875rem',
                          boxShadow: 'var(--shadow-md)'
                        }}
                      >
                        {t.clear ? v : '***'}
                      </div>
                    ))}
                  </div>
                  {t.clear ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => claimTicket(t)}
                        disabled={roundId === null || t.round >= (roundId || 0)}
                      >
                        💰 Claim
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
                      <button
                        className="btn btn-accent"
                        onClick={() => decryptTicket(t)}
                        disabled={t.loading}
                      >
                        {t.loading ? '🔄 Decrypting...' : '🔓 Decrypt'}
                      </button>
                      {/* Claim is enabled for closed rounds (round < currentRound) */}
                      { (t as any).claimed ? (
                        <button className="btn" disabled>Claimed</button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => claimTicket(t)}
                          disabled={roundId === null || t.round >= (roundId || 0)}
                        >
                          💰 Claim
                        </button>
                      )}
                    </div>
                  )}
                  {t.error && (
                    <div style={{
                      color: 'var(--error)',
                      fontSize: '0.75rem',
                      fontWeight: '500'
                    }}>
                      {t.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
