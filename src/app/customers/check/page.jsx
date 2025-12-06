import OneCustomerInfoCard from "@/app/components/one_customer_info_card.jsx";

async function fetchCustomer(id) {
  const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;

  if (!apiEndpoint) {
    throw new Error("NEXT_PUBLIC_API_ENDPOINT is not defined");
  }

  const res = await fetch(
    `${apiEndpoint}/customers?customer_id=${id}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch customer");
  }
  return res.json();
}

export default async function ReadPage({ searchParams }) {
  const id = searchParams?.id;

  if (!id) {
    return (
      <div className="alert alert-error">
        IDが指定されていません
      </div>
    );
  }

  const customerInfo = await fetchCustomer(id);

  return (
    <>
      <div className="alert alert-success">更新しました</div>
      <div className="card bordered bg-white border-blue-200 border-2 max-w-sm m-4">
        <OneCustomerInfoCard {...customerInfo[0]} />
      </div>
      <button className="btn btn-outline btn-accent">
        <a href="/customers">一覧に戻る</a>
      </button>
    </>
  );
}
