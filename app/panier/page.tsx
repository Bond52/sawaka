'use client'

import { useEffect, useState } from "react"
import { useTranslation } from "@/src/i18n/I18nProvider";
import { Article } from "../lib/apiSeller"

type CartItem = Article & { quantity: number }
type UserData = {
  token: string
  roles: string[]
  username: string
  firstName?: string
  lastName?: string
}

export default function PanierPage() {
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartItem[]>([])
  const [message, setMessage] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("cart")
    if (saved) setCart(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart))
  }, [cart])

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item =>
          item._id === id
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter(item => item.quantity > 0)
    )
  }

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item._id !== id))
  }

  const passerCommande = async () => {
    const savedUser = localStorage.getItem("user")
    const user: UserData | null = savedUser ? JSON.parse(savedUser) : null

    if (!user || !user.token || !user.roles.includes("acheteur")) {
      alert(t("alerts.buyerLoginRequired"))
      window.location.href = "/login?redirect=/panier"
      return
    }

    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_BASE ?? "https://ecommerce-web-avec-tailwind.onrender.com") + "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            items: cart.map(item => ({
              articleId: item._id,
              title: item.title,
              price: item.price,
              quantity: item.quantity,
            })),
          }),
        }
      )

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      if (data && data._id) {
        setMessage(t("alerts.orderCreated"))
        localStorage.removeItem("cart")
        setCart([])
      } else {
        throw new Error(t("alerts.invalidServerResponse"))
      }
    } catch (err: any) {
      setMessage(t("alerts.errorPrefix") + " " + err.message)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-end mb-4">
        <button
          onClick={passerCommande}
          disabled={cart.length === 0}
          className="px-6 py-3 rounded-lg font-semibold bg-brown-700 text-white hover:bg-brown-800 disabled:opacity-50"
        >
          {t("cart.checkout")}
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-brown-800 mb-6 flex items-center gap-2">
          🛒 {t("cart.title")}
        </h1>

        {cart.length === 0 ? (
          <p className="text-gray-600">{t("cart.empty")}</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {cart.map(item => (
              <li key={item._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  {item.images && item.images.length > 0 && (
                    <img src={item.images[0]} alt={item.title} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{item.title}</p>
                    <p className="text-sm text-gray-500">
                      {item.price}$ × {item.quantity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item._id, -1)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">–</button>
                  <span className="font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item._id, 1)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">+</button>
                  <p className="font-semibold text-gray-900 w-16 text-right">{item.price * item.quantity}$</p>
                  <button onClick={() => removeItem(item._id)} className="text-red-500 hover:underline text-sm">{t("common.delete")}</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between items-center mt-6 border-t pt-4">
          <h2 className="text-xl font-bold text-gray-800">{t("cart.total")}</h2>
          <span className="text-2xl font-extrabold text-green-600">{total}$</span>
        </div>

        {message && (
          <p className="mt-4 font-medium text-gray-700 text-center">{message}</p>
        )}
      </div>
    </div>
  )
}
