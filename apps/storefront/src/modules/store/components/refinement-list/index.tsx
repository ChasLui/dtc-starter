"use client"

import { useLocation, useRouter } from "@tanstack/react-router"
import { useCallback, useMemo } from "react"

import {
  OPTION_VALUE_QUERY_KEY,
  parseOptionValueIds,
} from "@lib/util/product-option-filters"
import OptionsPicker from "./options-picker"
import SortProducts, { SortOptions } from "./sort-products"

type RefinementListProps = {
  sortBy: SortOptions
  search?: boolean
  hideOptionsPicker?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  hideOptionsPicker = false,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const router = useRouter()
  const location = useLocation()

  const updateQueryParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(location.searchStr)
      updater(params)

      params.delete("page")

      const search: Record<string, unknown> = {}
      const sortByParam = params.get("sortBy")
      if (sortByParam) search.sortBy = sortByParam
      const optionValueIds = params.getAll(OPTION_VALUE_QUERY_KEY)
      if (optionValueIds.length) search.optionValueIds = optionValueIds

      router.navigate({
        to: location.pathname as never,
        search: search as never,
        replace: true,
      })
    },
    [location, router],
  )

  const setQueryParams = (name: string, value: string) =>
    updateQueryParams((params) => params.set(name, value))

  const selectedOptionValueIds = useMemo(
    () =>
      parseOptionValueIds(
        location.search as Record<string, string | string[] | undefined>,
      ),
    [location.search],
  )

  const setOptionValueIds = (valueIds: string[]) =>
    updateQueryParams((params) => {
      params.delete(OPTION_VALUE_QUERY_KEY)
      valueIds.forEach((valueId) =>
        params.append(OPTION_VALUE_QUERY_KEY, valueId),
      )
    })

  return (
    <div className="flex flex-col gap-12 py-4 mb-8 small:px-0 pl-6 small:min-w-[250px] small:ml-[1.675rem]">
      <SortProducts
        sortBy={sortBy}
        setQueryParams={setQueryParams}
        data-testid={dataTestId}
      />
      {!hideOptionsPicker && (
        <OptionsPicker
          selectedValueIds={selectedOptionValueIds}
          setOptionValueIds={setOptionValueIds}
        />
      )}
    </div>
  )
}

export default RefinementList
