/** Tag only the configured advertiser's exact text; preserve the consent verbatim. */
export default function ConsentText({
  text,
  advertiser,
}: {
  text: string;
  advertiser: string;
}) {
  const parts = advertiser ? text.split(advertiser) : [];
  if (parts.length !== 2) return <span>{text}</span>;
  return (
    <span>
      {parts[0]}
      <span data-tf-element-role="consent-advertiser-name">{advertiser}</span>
      {parts[1]}
    </span>
  );
}
