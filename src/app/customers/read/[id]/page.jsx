"use client";
// OneCustomerInfoCard を dynamic import で読み込み、SSR（サーバーサイドレンダリング）を無効にする
// 理由：このコンポーネントは useEffect 内で取得したデータをもとに描画されるため、
// サーバーが描画する初期HTMLと、クライアントが描画するHTMLが異なってしまい、
// 「Hydration failed」エラー（＝DOMの不一致）を引き起こす可能性がある。
// SSRを無効にすることで、クライアントでのみレンダリングされ、DOMのズレが発生しなくなる。

import dynamic from "next/dynamic";

// OneCustomerInfoCard を SSR せず、クライアント側でのみ動的に読み込むよう指定
const OneCustomerInfoCard = dynamic(
  () => import("@/app/components/one_customer_info_card.jsx"),
  {
    ssr: false,
  }
);
import BackButton from "./back_button";
import fetchCustomer from "./fetchCustomer";
import { useEffect, useState, use } from "react";

export default function ReadPage(props) {
  const params = use(props.params);
  const id = params.id;

  const [customerInfo, setCustomerInfo] = useState([]);

  useEffect(() => {
    const fetchAndSetCustomer = async () => {
      const customerData = await fetchCustomer(id);
      setCustomerInfo(customerData);
    };
    fetchAndSetCustomer();
  }, []);

  return (
    <>
      <div className="card bordered bg-white border-blue-200 border-2 max-w-sm m-4">
        <OneCustomerInfoCard {...customerInfo} />
        <BackButton>戻る</BackButton>
      </div>
    </>
  );
}
