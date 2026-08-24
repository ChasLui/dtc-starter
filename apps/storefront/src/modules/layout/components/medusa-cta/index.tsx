import { Text } from "@modules/common/components/ui"

import Medusa from "../../../common/icons/medusa"

const MedusaCTA = () => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      Powered by
      <a href="https://www.medusajs.com" target="_blank" rel="noreferrer">
        <Medusa fill="#9ca3af" className="fill-[#9ca3af]" />
      </a>
      &amp;
      <a
        href="https://tanstack.com"
        target="_blank"
        rel="noreferrer"
        className="hover:text-ui-fg-base"
      >
        TanStack Start
      </a>
    </Text>
  )
}

export default MedusaCTA
