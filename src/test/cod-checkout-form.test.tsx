import {describe,expect,it,vi} from "vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import {CodCheckoutForm} from "@/components/store/CodCheckoutForm";

describe("COD checkout form",()=>{
 it("shows Arabic errors on blur and reports validity without sending anything",()=>{
  const fetchSpy=vi.spyOn(globalThis,"fetch");
  const onValid=vi.fn();
  render(<CodCheckoutForm market="eg" onValidityChange={onValid}/>);
  const phone=screen.getByLabelText("رقم الموبايل");
  fireEvent.change(phone,{target:{value:"123"}});fireEvent.blur(phone);
  expect(screen.getByRole("alert").textContent).toMatch(/رقم الموبايل مش صحيح/);
  expect(phone.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(screen.getByLabelText("الاسم الكامل"),{target:{value:"منى أحمد"}});
  fireEvent.change(phone,{target:{value:"٠١٠ ١٢٣٤ ٥٦٧٨"}});
  fireEvent.change(screen.getByLabelText("المحافظة / المدينة"),{target:{value:"الجيزة"}});
  fireEvent.change(screen.getByLabelText("العنوان بالتفصيل"),{target:{value:"الدقي، شارع التحرير، مبنى ٥"}});
  expect(onValid).toHaveBeenLastCalledWith(true);
  expect(document.querySelector("form")!.getAttribute("action")).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
 });
});
