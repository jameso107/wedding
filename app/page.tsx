import { Postcard } from "./postcard";
import event from "./event.json";

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(event) }}
      />
      <Postcard />
    </>
  );
}
