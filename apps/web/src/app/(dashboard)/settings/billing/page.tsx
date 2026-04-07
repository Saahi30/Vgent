"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  CreditCard,
  Smartphone,
  Check,
  Clock,
  DollarSign,
  ArrowLeft,
  Sparkles,
  IndianRupee,
} from "lucide-react";

type Pack = {
  id: string;
  name: string;
  minutes: number;
  dollars_credit: number;
  price_inr: number;
  price_usd: number;
  popular: boolean;
};

type Step = "select" | "pay" | "success";

export default function BillingPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment flow state
  const [step, setStep] = useState<Step>("select");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi">("card");
  const [orderId, setOrderId] = useState("");
  const [upiDeeplink, setUpiDeeplink] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

  // UPI form
  const [upiId, setUpiId] = useState("");

  useEffect(() => {
    Promise.all([
      api.billing.packs(),
      api.tenants.usage(),
      api.billing.history(),
    ])
      .then(([p, u, h]) => {
        setPacks((p.data as Pack[]) || []);
        setUsage(u.data || null);
        setHistory((h.data as any[]) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPack = (pack: Pack) => {
    setSelectedPack(pack);
    setStep("pay");
  };

  const handleCreateOrder = async () => {
    if (!selectedPack) return;
    setProcessing(true);
    try {
      const res = await api.billing.createOrder({
        pack_id: selectedPack.id,
        payment_method: paymentMethod,
      });
      const order = res.data;
      setOrderId(order.order_id);
      if (order.upi_deeplink) {
        setUpiDeeplink(order.upi_deeplink);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!orderId) {
      // Create order first, then verify
      await handleCreateOrder();
    }
    setProcessing(true);
    try {
      // If no order yet, create one
      let currentOrderId = orderId;
      if (!currentOrderId) {
        const res = await api.billing.createOrder({
          pack_id: selectedPack!.id,
          payment_method: paymentMethod,
        });
        currentOrderId = res.data.order_id;
        setOrderId(currentOrderId);
        if (res.data.upi_deeplink) {
          setUpiDeeplink(res.data.upi_deeplink);
        }
      }

      const res = await api.billing.verifyPayment({
        order_id: currentOrderId,
        card_last4: paymentMethod === "card" ? cardNumber.slice(-4) : undefined,
        upi_id: paymentMethod === "upi" ? upiId : undefined,
      });

      setPaymentResult(res.data);
      setStep("success");
      toast.success("Payment successful! Credits added.");

      // Refresh usage
      const u = await api.tenants.usage();
      setUsage(u.data);
      const h = await api.billing.history();
      setHistory((h.data as any[]) || []);
    } catch (err: any) {
      toast.error(err.message || "Payment verification failed");
    } finally {
      setProcessing(false);
    }
  };

  const resetFlow = () => {
    setStep("select");
    setSelectedPack(null);
    setOrderId("");
    setUpiDeeplink("");
    setPaymentResult(null);
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardName("");
    setUpiId("");
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsNav />
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const minutesLimit = usage?.minutes_limit || 0;
  const dollarsLimit = usage?.dollars_limit || 0;

  return (
    <div className="space-y-6">
      <SettingsNav />

      {step === "select" && (
        <>
          <div>
            <h1 className="text-2xl font-bold">Billing & Credits</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Purchase call minutes and manage your balance
            </p>
          </div>

          {/* Current Balance */}
          {usage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" /> Minutes Balance
                  </div>
                  <p className="text-2xl font-bold">
                    {minutesLimit > 0
                      ? `${Math.max(0, minutesLimit - (usage.used_minutes || 0)).toFixed(0)}`
                      : usage.allocated_minutes || 0}
                  </p>
                  {minutesLimit > 0 && (
                    <>
                      <Progress
                        value={Math.min(100, ((usage.used_minutes || 0) / minutesLimit) * 100)}
                        className="mt-2 h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {usage.used_minutes || 0} of {minutesLimit} used
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" /> Dollar Balance
                  </div>
                  <p className="text-2xl font-bold">
                    $
                    {dollarsLimit > 0
                      ? Math.max(0, dollarsLimit - (usage.used_dollars || 0)).toFixed(2)
                      : (usage.allocated_dollars || 0).toFixed(2)}
                  </p>
                  {dollarsLimit > 0 && (
                    <>
                      <Progress
                        value={Math.min(100, ((usage.used_dollars || 0) / dollarsLimit) * 100)}
                        className="mt-2 h-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        ${usage.used_dollars || 0} of ${dollarsLimit} used
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-sm text-muted-foreground mb-1">Plan</div>
                  <p className="text-2xl font-bold capitalize">{usage.plan || "free"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {usage.calls_this_month || 0} calls this month
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Credit Packs */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Buy Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {packs.map((pack) => (
                <Card
                  key={pack.id}
                  className={`relative cursor-pointer transition-all hover:border-primary/50 ${
                    pack.popular ? "border-primary ring-1 ring-primary/20" : ""
                  }`}
                  onClick={() => handleSelectPack(pack)}
                >
                  {pack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        <Sparkles className="h-3 w-3 mr-1" /> Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="pt-6 pb-4 text-center">
                    <h3 className="text-lg font-semibold">{pack.name}</h3>
                    <div className="mt-3">
                      <span className="text-3xl font-bold flex items-center justify-center">
                        <IndianRupee className="h-6 w-6" />
                        {pack.price_inr.toLocaleString()}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        ${pack.price_usd} USD
                      </p>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{pack.minutes.toLocaleString()} minutes</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>${pack.dollars_credit} credit</span>
                      </div>
                    </div>
                    <Button className="w-full mt-4" variant={pack.popular ? "default" : "outline"}>
                      Select
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Payment History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Minutes</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h: any) => (
                      <tr key={h.id} className="border-b border-border">
                        <td className="p-4 text-muted-foreground">
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : "--"}
                        </td>
                        <td className="p-4">{h.note || "Credit added"}</td>
                        <td className="p-4 text-right font-medium text-green-600">
                          +{h.minutes_added}
                        </td>
                        <td className="p-4 text-right font-medium text-green-600">
                          +${h.dollars_added}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {step === "pay" && selectedPack && (
        <>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={resetFlow}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Complete Payment</h1>
              <p className="text-muted-foreground text-sm">
                {selectedPack.name} Pack — {selectedPack.minutes} minutes, ${selectedPack.dollars_credit} credit
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{selectedPack.name} Pack</span>
                  <span className="font-medium">{selectedPack.minutes} min</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Dollar Credit</span>
                  <span className="font-medium">${selectedPack.dollars_credit}</span>
                </div>
                <div className="flex justify-between py-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    {selectedPack.price_inr.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">(${selectedPack.price_usd} USD)</p>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Method Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setPaymentMethod("card");
                      setOrderId("");
                      setUpiDeeplink("");
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Card
                  </Button>
                  <Button
                    variant={paymentMethod === "upi" ? "default" : "outline"}
                    className="flex-1"
                    onClick={async () => {
                      setPaymentMethod("upi");
                      setOrderId("");
                      // Pre-create order for UPI to get QR code
                      try {
                        const res = await api.billing.createOrder({
                          pack_id: selectedPack.id,
                          payment_method: "upi",
                        });
                        setOrderId(res.data.order_id);
                        setUpiDeeplink(res.data.upi_deeplink || "");
                      } catch {}
                    }}
                  >
                    <Smartphone className="h-4 w-4 mr-2" /> UPI
                  </Button>
                </div>

                {/* Card Form */}
                {paymentMethod === "card" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Card Number</label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        className="mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cardholder Name</label>
                      <Input
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Expiry</label>
                        <Input
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">CVV</label>
                        <Input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="123"
                          maxLength={4}
                          className="mt-1 font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Demo mode — enter any card details. No real charges.
                    </p>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleVerifyPayment}
                      disabled={processing || !cardNumber || !cardExpiry || !cardCvv}
                    >
                      {processing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {processing ? "Processing..." : `Pay ₹${selectedPack.price_inr.toLocaleString()}`}
                    </Button>
                  </div>
                )}

                {/* UPI Form */}
                {paymentMethod === "upi" && (
                  <div className="space-y-4">
                    {upiDeeplink ? (
                      <div className="flex flex-col items-center space-y-4">
                        {/* QR Code */}
                        <div className="bg-white p-4 rounded-xl">
                          <QRCodeSVG
                            value={upiDeeplink}
                            size={200}
                            level="H"
                            includeMargin
                          />
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                          Scan this QR code with any UPI app
                        </p>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Or pay to UPI ID</p>
                          <p className="font-mono text-sm font-medium mt-1">vgent@ybl</p>
                          <p className="text-lg font-bold mt-1 flex items-center justify-center">
                            <IndianRupee className="h-4 w-4" />
                            {selectedPack.price_inr.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-full space-y-2">
                          <div>
                            <label className="text-sm font-medium">Your UPI ID (optional)</label>
                            <Input
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              placeholder="yourname@paytm"
                              className="mt-1"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Demo mode — click below after &quot;scanning&quot;. No real charges.
                          </p>
                          <Button
                            className="w-full"
                            size="lg"
                            onClick={handleVerifyPayment}
                            disabled={processing}
                          >
                            {processing ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            {processing ? "Verifying..." : "I have paid"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {step === "success" && paymentResult && (
        <div className="max-w-md mx-auto text-center space-y-6 py-8">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Payment Successful!</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your credits have been added to your account.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-sm">{paymentResult.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">
                  {paymentResult.payment_method === "card"
                    ? `Card ****${paymentResult.card_last4 || "0000"}`
                    : `UPI ${paymentResult.upi_id || ""}`}
                </span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Minutes Added</span>
                  <span>+{paymentResult.credits_added?.minutes}</span>
                </div>
                <div className="flex justify-between text-green-600 font-medium mt-1">
                  <span>Credit Added</span>
                  <span>+${paymentResult.credits_added?.dollars}</span>
                </div>
              </div>
              <div className="border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Minutes Balance</span>
                  <span className="font-medium">{paymentResult.new_balance?.allocated_minutes}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">New Dollar Balance</span>
                  <span className="font-medium">${paymentResult.new_balance?.allocated_dollars}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Button onClick={resetFlow} className="w-full">
            Buy More Credits
          </Button>
        </div>
      )}
    </div>
  );
}
