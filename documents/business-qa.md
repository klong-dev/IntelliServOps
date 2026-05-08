# Bo cau hoi nghiep vu IntelliRentOps (end-to-end)

Tai lieu nay tong hop bo cau hoi nghiep vu va cau tra loi chi tiet de phuc vu bao ve do an/thesis. Noi dung duoc gom theo nhom chu de de de on tap va trinh bay.

## 1. Tong quan va gia tri

### Q1. Muc tieu nghiep vu cot loi cua IntelliRentOps la gi?

**Tra loi**

- Hop nhat toan bo vong doi cho thue can ho tren mot nen tang.
- Giam phan man quy trinh (hop dong, hoa don, bao tri, ho tro).
- Tu dong hoa cac buoc lap lai nhu tao hoa don va nhac gia han.
- Tang toc do chuyen doi tu guest sang nguoi thue that su.
- Minh bach hoa trang thai can ho, hop dong, va thanh toan theo thoi gian.
- Ket noi web, mobile, va admin panel trong mot he thong dong bo.
- Tich hop IoT de mo khoa thong minh va do dien nuoc tu dong.
- Giam chi phi van hanh nhan su nho quy trinh ro rang.
- Cai thien trai nghiem nguoi thue va chu nha qua thong tin nhat quan.
- Dat nen tang cho mo rong quy mo van hanh nhieu can ho.

### Q2. He thong giai quyet nhung “pain point” nao cua quan ly cho thue truyen thong?

**Tra loi**

- Tranh tinh trang thong tin bi cat khuc giua Excel, Zalo, va giay to.
- Loai bo sai sot do nhap lieu thu cong tren hop dong va hoa don.
- Giam do tre khi xu ly bao tri va ho tro khach hang.
- Han che khieu nai do khong ro rang ve gia, thoi han, va phu thu.
- Giam rui ro mat doanh thu do hoa don bi bo sot.
- Giam xung dot do khong co lich su va log ro rang.
- Tang do tin cay trong quy trinh giao nha va nhan nha.
- Kiem soat thanh toan theo chu ky va nhac no tu dong.
- Tang tinh minh bach cho chu nha trong doanh thu va hoa hong.
- Tao du lieu tap trung de bao cao va ra quyet dinh.

### Q3. Nhung chi so kinh doanh nao thuong dung de danh gia hieu qua?

**Tra loi**

- Ty le chuyen doi guest -> viewing -> hop dong.
- Ty le lap day can ho (occupancy rate) theo thang/quy.
- Doanh thu binh quan moi can ho (ARPU) va tong doanh thu.
- Ty le qua han hoa don va so ngay thu hoi cong no.
- Ty le gia han hop dong va ty le huy som.
- Thoi gian xu ly bao tri trung binh (TAT).
- Ty le no-show khi hen xem nha.
- So luong ticket ho tro va ty le dong dung han.
- Chi phi van hanh moi hop dong (nhan su + he thong).
- Muc do hai long cua nguoi thue/chu nha (NPS).

## 2. Actors va vai tro

### Q4. He thong co nhung actor nao va pham vi quyen ra sao?

**Tra loi**

- Guest: khach chua thue, duoc xem va de lai nhu cau.
- User: nguoi thue chinh thuc, su dung app de quan ly hop dong.
- Staff: nhan vien thuc thi (xem nha, bao tri, ho tro).
- Operator: dieu phoi cong viec va duyet quy trinh nghiep vu.
- Admin: quan tri toan he thong, bao gom cau hinh va RBAC.
- Partner: chu nha/doi tac dang can ho len he thong.
- Moi actor co giao dien va du lieu rieng, theo RBAC.
- User chi thay du lieu cua minh, khong thay du lieu khac.
- Staff thay duoc cac request duoc giao, khong can toan bo.
- Admin co quyen cao nhat de giam sat va dieu chinh.

### Q5. Khac biet nghiep vu giua Guest va User la gi?

**Tra loi**

- Guest la khach chua ky hop dong, khong co tai khoan chinh thuc.
- Guest co the tim kiem, xem chi tiet can ho tren web.
- Guest gui viewing request de xin xem nha.
- User la nguoi da ky hop dong, co tai khoan trong he thong.
- User su dung mobile app de xem hop dong va hoa don.
- User co the thanh toan, bao tri, va tao ticket ho tro.
- User co the co dong thue (co-tenant) trong cung hop dong.
- Du lieu cua Guest chu yeu phuc vu chuyen doi sang hop dong.
- Du lieu cua User phuc vu quan ly trong suot thoi gian thue.
- Guest tro thanh User sau khi hop dong duoc ky va kich hoat.

### Q6. Staff va Operator khac nhau o diem nao?

**Tra loi**

- Staff la nguoi thuc thi tai hien truong (xem nha, bao tri).
- Operator la nguoi dieu phoi, duyet va phan cong cong viec.
- Staff nhan thong bao, tuong tac truc tiep voi khach.
- Operator quan ly pipeline lead, booking, va hop dong.
- Staff cap nhat ket qua thuc te (anh, ghi chu, chi phi).
- Operator ra quyet dinh phe duyet can ho/yeu cau.
- Staff khong tu dong thay doi quy trinh nghiep vu toan cuc.
- Operator theo doi KPI, ti le chuyen doi, va tinh hinh van hanh.
- Staff co the tao lich hen nhung khong co quyen thay doi policy.
- Operator la diem kiem soat chat luong toan quy trinh.

### Q7. Admin lam gi trong mo hinh nghiep vu?

**Tra loi**

- Quan ly he thong phan quyen va vai tro (RBAC).
- Quan ly danh sach nhan su (staff/operator) va tai khoan.
- Quan ly cau hinh chung, chinh sach, va tai lieu phap ly.
- Theo doi bao cao toan he thong (doanh thu, ty le lap day).
- Xu ly tinh huong bat thuong/ngoai le cap cao.
- Quan tri du lieu du an, thong nhat tieu chuan.
- Duoc quyen can thiep khi co tranh chap nghiep vu.
- Quan ly tich hop ngoai (payment, storage, notification).
- Dam bao tuan thu quy trinh va an ninh he thong.
- Co quyen audit va trich xuat du lieu theo nhu cau.

### Q8. Partner (chu nha) tham gia he thong nhu the nao?

**Tra loi**

- Partner dang ky va cung cap thong tin phap ly can ho.
- Gui yeu cau hop tac va ho so can thiet.
- Duoc Operator/Staff kiem tra, danh gia, va phe duyet.
- Sau khi duoc duyet, Partner dang can ho len he thong.
- Ky hop dong hop tac khai thac can ho voi nen tang.
- Theo doi doanh thu, hoa hong, va tinh hinh cho thue.
- Nhan thong bao ve trang thai can ho va dong tien.
- Co dashboard rieng de quan ly tai san cua minh.
- Chi duoc thay du lieu cua cac can ho do minh so huu.
- Dong vai tro la nguon cung can ho cho he thong.

## 3. Guest, viewing, booking, reservation

### Q9. Luong tim kiem can ho cua Guest dien ra the nao?

**Tra loi**

- Guest truy cap website va xem danh sach can ho.
- Co bo loc theo gia, vi tri, so phong, noi that.
- Xem hinh anh, video, tien ich, va mo ta chi tiet.
- Kiem tra thong tin can ho dang trong trang thai san sang.
- Guest de lai thong tin lien he neu quan tam.
- He thong luu contact request de tao lead.
- Thong tin nay la dau vao cho chuyen doi thanh hop dong.
- Guest khong can tai khoan de thuc hien hanh dong nay.
- Muc tieu la tao “interest” trong phan dau phieu chuyen doi.
- Du lieu tim kiem ho tro phan tich xu huong nhu cau.

### Q10. Viewing request duoc tao va gan Staff nhu the nao?

**Tra loi**

- Guest gui viewing request voi can ho muc tieu.
- Request bao gom ho ten, lien he, so nguoi o, nhu cau.
- He thong tu dong tim Staff theo workingDistrict.
- Neu khong co Staff phu hop, fallback theo workingCity.
- Neu van khong co, gan cho bat ky Staff active.
- Staff nhan thong bao de lien he xac nhan.
- Operator co the theo doi luong request de dieu phoi.
- Lich su request duoc luu de danh gia ty le chuyen doi.
- Logic assignment giup giam thoi gian phan hoi khach.
- Quy trinh nay la dau vao cho buoc tao appointment.

### Q11. Appointment va slot limit duoc quan ly ra sao?

**Tra loi**

- Staff tao appointment voi ngay, gio, thoi luong, dia diem.
- He thong kiem tra so luong lich hen trung thoi diem.
- Slot limit dua tren building + apartment type.
- Neu vuot gioi han, he thong tu choi tao lich.
- Muc tieu la tranh qua tai va tao trai nghiem tot.
- Staff co the cap nhat ghi chu/yeu cau dac biet.
- Lich hen giup to chuc nhan su va theo doi ty le no-show.
- Operator co the xem lich tong the de can doi nguon luc.
- Appointment la buoc bat buoc truoc khi tao booking.
- Ket qua appointment quyet dinh co chuyen sang booking hay khong.

### Q12. BookingRequest va Reservation dung de lam gi?

**Tra loi**

- BookingRequest the hien y dinh thue sau khi xem nha.
- Operator hoac Staff se danh gia va phe duyet.
- Neu duoc chap nhan, he thong tao Reservation giu can ho.
- Reservation co the co thoi han het hieu luc.
- Trang thai reservation giup tranh dau gia can ho cho khach khac.
- Reservation la cau noi giua booking va hop dong.
- Neu het han hoac khach huy, can ho ve lai trang thai available.
- Reservation cung la co che giam no-show hoac do tre ky hop dong.
- Data reservation cho phep do luong hieu qua chuyen doi.
- Day la buoc kiem soat rui ro trong giai doan chot deal.

### Q13. Chuyen doi tu Guest sang User duoc thuc hien khi nao?

**Tra loi**

- Khi hop dong duoc tao va ky hop le.
- He thong tao tai khoan User (tenant) tu thong tin xac thuc.
- User duoc cap quyen truy cap mobile app.
- User co the xem hop dong, hoa don, va thong bao.
- Guest record van duoc giu lai de truy vet lich su.
- Chuyen doi nay danh dau giai doan tu lead sang doanh thu.
- Operator/Staff co the theo doi ti le chuyen doi theo pipeline.
- He thong bat dau gan User vao contract members.
- Quy trinh nay dong bo voi giai doan kich hoat hop dong.
- Day la moc chinh thuc bat dau chu ky dich vu.

## 4. Vong doi hop dong thue

### Q14. Dieu kien nghiep vu de tao hop dong la gi?

**Tra loi**

- Can ho phai dang o trang thai available.
- Thoi gian thue khong duoc trung voi hop dong khac.
- Thoi han thue nam trong thoi han hop tac cua can ho (neu co).
- Phai co toi thieu 1 thanh vien trong hop dong.
- Chi duoc co 1 primary member va 1 primary contact.
- Thanh vien khong duoc trung userId trong cung hop dong.
- Thong tin gia thue, tien coc, ngay thanh toan phai hop le.
- Du lieu se duoc luu de phuc vu sinh PDF va hoa don.
- Operator/Staff la nguoi duoc phep tao hop dong.
- Tat ca dieu kien nay nham giam rui ro phap ly va van hanh.

### Q15. Cac trang thai hop dong va y nghia nghiep vu?

**Tra loi**

- Draft: hop dong moi tao, chua ky va chua kich hoat.
- Pending: hop dong dang cho xu ly/ky/hoan tat dieu kien.
- Signed: hop dong da co PDF ky, chua kich hoat.
- Active: hop dong dang hieu luc, tenant dang o.
- Expired: hop dong het han hoac qua han dat coc.
- Terminated: hop dong bi huy som theo yeu cau hop le.
- Renewed: gia tri enum du phong cho hop dong da gia han.
- Trang thai gop phan quyet dinh quyen truy cap va billing.
- Trang thai dong bo voi trang thai can ho (occupied/reserved).
- Trang thai la trung tam cho cac luong thong bao va nhac nho.

### Q16. Quy trinh ky hop dong va upload PDF dien ra the nao?

**Tra loi**

- Hop dong duoc tao voi status draft.
- Nguoi tham gia ky tren file PDF cua he thong.
- File PDF da ky duoc upload len he thong.
- Sau upload, hop dong chuyen sang signed.
- He thong luu link tai lieu (contractDocumentUrl) de truy cap.
- He thong co the tao token public de xem PDF tam thoi.
- PDF la bang chung phap ly cua giao dich.
- Neu upload khong dung dinh dang, he thong tu choi.
- Upload PDF co the keo theo viec tao hoa don dat coc.
- Day la diem chuyen doi tu “du kien” sang “cam ket”.

### Q17. Dat coc va kich hoat hop dong duoc xu ly ra sao?

**Tra loi**

- Sau khi ky PDF, he thong tao hoa don dat coc.
- Hoa don dat coc co han thanh toan va theo doi trang thai.
- Khi hoa don dat coc duoc thanh toan, hop dong co dieu kien kich hoat.
- Kich hoat chi hop le khi ngay bat dau <= hom nay va chua het han.
- Khi active, can ho chuyen sang occupied.
- He thong tao quan he UserApartment cho cac thanh vien.
- IoT door PIN duoc reset de tenant tu thiet lap.
- He thong sinh hoa don tien thue theo chu ky.
- Neu khong dat coc dung han, hop dong co the bi expired.
- Dat coc la bien phap giam rui ro cho ca hai ben.

### Q18. Quy tac quan ly thanh vien hop dong la gi?

**Tra loi**

- Hop dong co it nhat 1 thanh vien va 1 primary member.
- Co the co co-tenant hoac guarantor tuy nhu cau.
- Primary contact phai la primary member.
- So thanh vien khong vuot qua max occupants cua can ho.
- Them thanh vien can CCCD da verify.
- Hop dong da signed/active khong duoc them thanh vien.
- Ti le dong gop (sharePercentage) co the duoc luu de phan chia.
- Thanh vien duoc gan trang thai active/moved_out theo vong doi.
- Thanh vien la co so de cap quyen truy cap app va thanh toan.
- Quy tac nay bao dam an ninh va su ro rang ve trach nhiem.

### Q19. Gia han hop dong duoc thiet ke nhu the nao?

**Tra loi**

- Chi cho phep gia han trong 30 ngay cuoi truoc khi het han.
- Chi User trong hop dong moi co quyen yeu cau gia han.
- Co 2 lua chon: giu nguyen thong tin cu hoac tu tuy chinh.
- Neu tuy chinh, co the doi so thang va danh sach thanh vien.
- Hop dong gia han duoc tao moi o trang thai draft.
- He thong kiem tra khong trung lich voi hop dong khac.
- Van can tuan thu gioi han max occupants.
- Hop dong moi duoc gan nhan category renewal.
- PDF hop dong moi duoc tao lai tu thong tin cap nhat.
- Gia han giup giu doanh thu va on dinh ty le lap day.

### Q20. Cham dut hop dong som anh huong gi den he thong?

**Tra loi**

- Chi primary member moi co quyen huy hop dong.
- Hop dong chuyen sang terminated va luu ly do.
- Can ho duoc tra ve trang thai available.
- Hoa don chua thanh toan bi huy theo quy tac.
- Tien dat coc co the bi forfeited tuy truong hop.
- UserContractMember va UserApartment chuyen sang moved_out.
- Reservation lien quan se duoc cancel de giai phong can ho.
- He thong luu lai lich su cham dut de doi so cong no.
- Mo ta ro rang de tranh tranh chap phap ly.
- Cham dut som la ngoai le can co quy trinh kiem soat.

### Q21. PDF hop dong duoc sinh va cap nhat nhu the nao?

**Tra loi**

- He thong tu dong sinh PDF tu du lieu hop dong va can ho.
- PDF co cac dieu khoan co dinh va cac dieu khoan bo sung.
- Thong tin ben A co gia tri mac dinh neu chua du.
- Thong tin ben B lay tu primary member va danh sach thanh vien.
- Gia dien/nuoc co the duoc chen tu Utility Rate Plan.
- He thong ho tro chu ky dien tu (anh chu ky).
- Cap nhat noi dung PDF se regen va ghi de file cu.
- PDF la dau ra phap ly nen can quan ly phien ban.
- PDF duoc luu duoi dang binary va cung cap endpoint tai ve.
- Token public giup chia se PDF an toan trong thoi gian ngan.

## 5. Hoa don va thanh toan

### Q22. Chu ky tao hoa don tien thue hang thang ra sao?

**Tra loi**

- Hoa don duoc tao theo chu ky hang thang khi hop dong active.
- Ky billing duoc tinh tu startDate den endDate.
- Ngay thanh toan duoc lay tu paymentDueDay trong hop dong.
- Hoa don co trang thai tu issued den paid/overdue.
- He thong tu dong tao hoa don neu chua ton tai cho ky do.
- Chi hop dong active moi duoc sinh hoa don.
- Hoa don duoc gui thong bao den tat ca thanh vien.
- Co the trich xuat lich su hoa don cho doi so.
- Quy trinh nay giup dong bo dong tien va ke hoach thu.
- Hoa don la can cu cho thanh toan va bao cao tai chinh.

### Q23. Hoa don dien nuoc va Utility Rate Plan duoc xu ly the nao?

**Tra loi**

- He thong quan ly Utility Meter cho dien va nuoc.
- Chi so tieu thu duoc ghi nhan tu meter readings.
- Utility Rate Plan quy dinh don gia theo bac tieu thu.
- He thong tinh toan tieu thu theo ky va tao hoa don utility.
- Neu utilities duoc “included”, co the khong tao hoa don.
- Hoa don utility co chi tiet bac gia va luong tieu thu.
- Du lieu nay cung duoc hien thi trong PDF hop dong.
- Utility billing giup minh bach chi phi bien doi.
- Tenant co the xem lich su tieu thu de tu dieu chinh.
- Quy trinh nay lien ket chat che voi IoT va metering.

### Q24. Hoa don dat coc va xu ly tien coc la gi?

**Tra loi**

- Dat coc duoc tao khi hop dong da ky (signed).
- He thong tao hoa don contract deposit voi so tien tu hop dong/can ho.
- Trang thai hoa don theo doi qua cac buoc issued -> paid.
- Khi paid, hop dong co dieu kien kich hoat.
- Tien coc mac dinh o trang thai held trong qua trinh thue.
- Neu huy som vi pham, tien coc co the bi forfeited.
- Neu ket thuc dung han, tien coc co the duoc hoan tra.
- Tien coc duoc ghi lai de minh bach doi so.
- Quy trinh xu ly coc giam tranh chap giua hai ben.
- Day la co che bao ve rui ro tai chinh cho chu nha.

### Q25. Quy trinh thanh toan voi PayOS hoac cong thanh toan la gi?

**Tra loi**

- User tao yeu cau thanh toan tu hoa don.
- He thong tao payment link va chuyen huong sang cong thanh toan.
- User hoan tat giao dich tren cong thanh toan.
- Webhook tu PayOS gui ve he thong de xac nhan.
- He thong cap nhat trang thai payment va invoice la paid.
- Neu webhook loi, co the xac nhan thu cong.
- Lich su giao dich duoc luu de doi so sau nay.
- Xu ly idempotent de tranh cap nhat trung.
- Thanh toan duoc thong bao den nguoi thue va operator.
- Quy trinh nay giam can thiep thu cong va tang toc thu tien.

### Q26. Xu ly qua han hoa don va nhac no nhu the nao?

**Tra loi**

- Hoa don qua han se co trang thai overdue.
- He thong co the gui thong bao nhac no theo chu ky.
- Operator/Staff theo doi danh sach hoa don qua han.
- Qua han co the anh huong den quyet dinh gia han hop dong.
- Thong tin qua han giup canh bao rui ro dong tien.
- He thong luu lich su nhac no de co bang chung xu ly.
- Co the ap dung chinh sach xu phat tuy theo quy dinh.
- Qua han lien quan den danh gia uy tin nguoi thue.
- Quy trinh nay can ro rang de tranh tranh chap.
- Muc tieu la thu hoi cong no nhanh ma van giu trai nghiem tot.

## 6. Vong doi can ho va occupancy

### Q27. Trang thai can ho thay doi theo nhung quy tac nao?

**Tra loi**

- Available: can ho san sang cho thue.
- Reserved: can ho dang duoc giu cho booking/reservation.
- Occupied: can ho dang co hop dong active.
- Maintenance: can ho tam dung de bao tri.
- Inactive: can ho khong kinh doanh hoac bi huy hop tac.
- Verified/Pending: can ho cho doi tac dang cho duyet.
- Trang thai thay doi theo cac su kien nghiep vu (approve, sign, activate).
- Quy tac giup he thong biet can ho co the duoc chao ban hay khong.
- Trang thai dong bo voi contract va reservation.
- Day la nen tang cho quy hoach ton kho can ho.

### Q28. Occupancy va UserApartment duoc dong bo ra sao?

**Tra loi**

- Khi hop dong active, he thong tao UserApartment cho tung thanh vien.
- UserApartment luu quan he nguoi - can ho - hop dong.
- Trang thai UserApartment theo doi active/moved_out.
- Thong tin nay dung de cap quyen IoT va truy cap app.
- Khi hop dong het han, UserApartment chuyen moved_out.
- He thong tu dong dong bo trang thai can ho theo occupancy.
- Neu khong con hop dong active, can ho ve available hoac reserved.
- Dung de theo doi lich su luu tru cua nguoi thue.
- Ho tro bao cao thong ke muc do su dung can ho.
- Giam sai sot khi co nhieu thanh vien trong cung can ho.

### Q29. He thong phong tranh trung lich va vuot qua suc chua nhu the nao?

**Tra loi**

- Hop dong moi khong duoc trung khoang thoi gian voi hop dong khac.
- Reservation giu can ho trong thoi gian ngan de tranh dat trung.
- Appointment co slot limit theo can ho de tranh qua tai.
- So thanh vien hop dong khong vuot max occupants cua can ho.
- He thong kiem tra duplicate thanh vien trong hop dong.
- Neu vi pham, yeu cau bi tu choi voi ly do ro rang.
- Quy tac nay giup tranh tranh chap va qua tai co so vat chat.
- Operator theo doi cac truong hop ngoai le de dieu chinh.
- Du lieu kiem soat la co so cho quyet dinh phe duyet.
- Muc tieu la an toan va trai nghiem tot cho nguoi thue.

## 7. Bao tri, ho tro, va noi bo

### Q30. Luong bao tri (Maintenance) hoat dong the nao?

**Tra loi**

- User tao yeu cau bao tri voi mo ta va hinh anh.
- Yeu cau co trang thai Submitted khi moi tao.
- Staff nhan viec va chuyen trang thai sang InProgress.
- Staff cap nhat ghi chu cong viec va chi phi (neu co).
- Khi hoan thanh, trang thai chuyen sang Completed.
- Operator co the theo doi tien do va do uu tien.
- Yeu cau bao tri gan voi can ho va hop dong active.
- He thong luu lich su de phan tich chi phi van hanh.
- Quy trinh ro rang giup giam thoi gian xu ly su co.
- User nhan thong bao khi trang thai thay doi.

### Q31. Luong ticket ho tro khach hang ra sao?

**Tra loi**

- User tao ticket cho cac van de chinh sach, hoa don, hop dong.
- Ticket bat dau o trang thai Open.
- Operator gan ticket cho Staff phu trach.
- Staff xu ly va cap nhat trang thai InProgress.
- Khi giai quyet, ticket chuyen sang Resolved.
- User xac nhan ket qua va dong ticket (Closed).
- He thong luu lich su trao doi de truy vet.
- Co the phan loai theo category de thong ke van de lap lai.
- Ticket giup tach van de tong quat ra khoi luong bao tri.
- Day la kenh phan hoi chinh thuc giua tenant va van hanh.

### Q32. Task noi bo duoc quan ly nhu the nao?

**Tra loi**

- Operator tao Task tu nhu cau viewing, bao tri, kiem tra.
- Task co nguoi duoc giao va han hoan thanh.
- Staff thuc hien va cap nhat trang thai.
- Task giup phan cong ro rang va do luong nang suat.
- Lich su task giup danh gia chat luong nhan su.
- Task co the gan lien voi can ho, appointment, hoac maintenance.
- Quy trinh task ho tro dieu phoi nhieu nguon luc.
- Co the uu tien task theo do khan cap.
- Task la cong cu quan trong trong van hanh hang ngay.
- Thong bao duoc gui khi task duoc giao hoac cap nhat.

## 8. Partner va hop tac

### Q33. Luong doi tac (Partner) va hop dong hop tac dien ra the nao?

**Tra loi**

- Partner dang ky va nop ho so can ho.
- Operator/Staff kiem tra ho so va phe duyet.
- Can ho duoc day tu trang thai verified/pending sang available.
- Partner ky hop dong hop tac va upload PDF.
- Sau ky, can ho duoc dua vao kho cho thue.
- He thong quan ly ti le hoa hong theo phase hieu luc.
- Partner co the theo doi doanh thu va cong no.
- Neu huy hop tac, can ho chuyen sang inactive.
- Luong nay bao dam minh bach quyen so huu va doanh thu.
- Day la nen tang mo rong nguon cung can ho.

## 9. IoT, thong bao, va bao mat

### Q34. IoT duoc tich hop vao nghiep vu nhu the nao?

**Tra loi**

- IoT cho phep tenant mo khoa va dieu khien thiet bi tu app.
- Smart lock lien ket voi hop dong va UserApartment.
- Khi hop dong active, PIN cua co the duoc reset va cap moi.
- Utility meter gui du lieu tieu thu dien/nuoc dinh ky.
- Du lieu IoT ho tro tao hoa don utility chinh xac.
- IoT giup tang trai nghiem va an toan cho nguoi thue.
- He thong luu log de truy vet su co hoac tranh chap.
- IoT device co trang thai active/maintenance/deactivated.
- Ket noi IoT giam phu thuoc vao quy trinh thu cong.
- Day la diem khac biet lon so voi he thong quan ly truyen thong.

### Q35. Chien luoc thong bao trong he thong la gi?

**Tra loi**

- Thong bao duoc gui khi co viewing request, appointment, hoa don.
- Nhac gia han hop dong theo moc thoi gian (30/14/7/3/1 ngay).
- Thong bao ve trang thai bao tri va ticket cho tenant.
- Thong bao thanh toan thanh cong hoac qua han.
- Thong bao den staff khi duoc giao task hoac request.
- Thong bao den operator khi partner ky/huy hop tac.
- Kenh thong bao chinh la in-app, co the mo rong push.
- Muc tieu la giam thoi gian phan hoi va tang minh bach.
- Thong bao luu metadata de truy vet va audit.
- Thong bao la co che giam sat thuc thi nghiep vu.

### Q36. RBAC va bao mat du lieu duoc to chuc ra sao?

**Tra loi**

- He thong su dung RBAC theo actor type (guest/user/staff/operator/admin/partner).
- User chi duoc xem hop dong, hoa don, can ho cua minh.
- Staff xem duoc task/maintenance/ticket duoc giao.
- Operator duoc quan ly nhieu luong nghiep vu va phe duyet.
- Admin co quyen cao nhat va truy cap day du du lieu.
- Partner chi xem du lieu can ho va doanh thu cua minh.
- Du lieu trong mot database chung, tach quyen bang RBAC.
- Log va trang thai duoc luu de audit khi can tranh chap.
- JWT va token het han dam bao phien dang nhap an toan.
- Bao mat du lieu la nen tang cho long tin cua cac ben.
