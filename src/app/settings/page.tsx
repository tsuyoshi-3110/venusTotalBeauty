// app/(admin)/settings/page.tsx の一部など
import AddressAutocomplete from "@/components/maps/AddressAutocomplete";
import MapPreview from "@/components/maps/MapPreview";
import { adminDb } from "@/lib/firebase-admin";

export default async function SettingsPage({ params: { siteKey } }: any) {
  const snap = await adminDb.doc(`siteSettingsEditable/${siteKey}`).get();
  const s = snap.data() as any;
  const lat = s?.address?.lat;
  const lng = s?.address?.lng;

  return (
    <div className="space-y-6">
      <AddressAutocomplete siteKey={siteKey} />
      <MapPreview lat={lat} lng={lng} />
      {/* ここに前回作った GoogleMapsSection（トグル）を並べてもOK */}
    </div>
  );
}
