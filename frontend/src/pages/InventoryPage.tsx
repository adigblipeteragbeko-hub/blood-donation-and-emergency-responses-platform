export default function InventoryPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Blood Inventory</h1>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2">Blood Group</th>
            <th className="py-2">Units</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">O_POS</td>
            <td className="py-2">12</td>
          </tr>
          <tr>
            <td className="py-2">A_NEG</td>
            <td className="py-2">4</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
