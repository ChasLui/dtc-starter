import { Link, useParams } from "@tanstack/react-router"
import React from "react"

/**
 * Use this component to create a TanStack Router `<Link />` that persists the current country code in the url,
 * without having to explicitly pass it as a prop.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: unknown
}) => {
  const { countryCode } = useParams({ strict: false })

  return (
    <Link to={`/${countryCode}${href}` as never} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
