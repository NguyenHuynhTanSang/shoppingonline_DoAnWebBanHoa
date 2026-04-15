const products = [
  // =========================
  // BOUQUET - BÓ HOA
  // =========================
  {
    id: 1,
    code: 'B01',
    type: 'bouquet',
    categorySlug: 'bo-hoa-8-3',
    name: 'Bó hoa hồng ngọt ngào',
    price: 800000,
    image: '/images/bo-hoa-hong-leo.png',
    description: 'Bó hoa hồng đẹp, thích hợp tặng người yêu hoặc người thân trong dịp đặc biệt.'
  },
  {
    id: 2,
    code: 'B02',
    type: 'bouquet',
    categorySlug: 'bo-hoa-8-3',
    name: 'Bó hoa 99 bông',
    price: 2500000,
    image: '/images/bo-hoa-99-bong.png',
    description: 'Mẫu hoa sang trọng, thể hiện tình cảm chân thành và đẳng cấp.'
  },
  {
    id: 3,
    code: 'B03',
    type: 'bouquet',
    categorySlug: 'bo-hoa-8-3',
    name: 'Bó hoa cưới trắng',
    price: 1500000,
    image: '/images/bo hoa cuoi trang.png',
    description: 'Mẫu hoa cưới tinh tế, sang trọng và thanh lịch.'
  },
  {
    id: 4,
    code: 'B04',
    type: 'bouquet',
    categorySlug: 'bo-hoa-8-3',
    name: 'Bó hồng pastel',
    price: 950000,
    image: '/images/bo-hoa-hong-pastel-dep-1.png',
    description: 'Bó hoa pastel nhẹ nhàng, ngọt ngào, phù hợp nhiều dịp.'
  },
  {
    id: 5,
    code: 'B05',
    type: 'bouquet',
    categorySlug: 'bo-hoa-8-3',
    name: 'Bó hoa tình yêu',
    price: 990000,
    image: '/images/bo-hoa-tinh-yeu.png',
    description: 'Bó hoa dành cho những dịp tỏ tình, kỷ niệm hoặc ngày đặc biệt.'
  },

  // =========================
  // FLOWER BASKET - GIỎ HOA
  // =========================
  {
    id: 6,
    code: 'FB01',
    type: 'flower-basket',
    categorySlug: 'gio-hoa-8-3',
    name: 'Giỏ hoa khai trương',
    price: 1900000,
    image: '/images/gio-hoa-khai-truong-mau-hong.png',
    description: 'Giỏ hoa phù hợp chúc mừng khai trương, chúc phát tài phát lộc.'
  },
  {
    id: 7,
    code: 'FB02',
    type: 'flower-basket',
    categorySlug: 'gio-hoa-8-3',
    name: 'Giỏ hoa chúc mừng',
    price: 1700000,
    image: '/images/gio-hoa-chuc-mung.png',
    description: 'Thiết kế giỏ hoa nổi bật, thích hợp làm quà chúc mừng sang trọng.'
  },
  {
    id: 8,
    code: 'FB03',
    type: 'flower-basket',
    categorySlug: 'gio-hoa-8-3',
    name: 'Giỏ hoa hồng đỏ',
    price: 1350000,
    image: '/images/gio-hoa-hong-do.png',
    description: 'Giỏ hoa hồng đỏ thể hiện tình yêu nồng nhiệt và chân thành.'
  },
  {
    id: 9,
    code: 'FB04',
    type: 'flower-basket',
    categorySlug: 'gio-hoa-8-3',
    name: 'Giỏ hoa sinh nhật rực rỡ',
    price: 1450000,
    image: '/images/gio-hoa-sinh-nhat-ruc-ro.png',
    description: 'Giỏ hoa tươi trẻ, màu sắc nổi bật, phù hợp cho sinh nhật và chúc mừng.'
  },
  {
    id: 10,
    code: 'FB05',
    type: 'flower-basket',
    categorySlug: 'gio-hoa-8-3',
    name: 'Giỏ hoa ngọt ngào',
    price: 1250000,
    image: '/images/gio-hoa-ngot-ngao.png',
    description: 'Giỏ hoa mang phong cách nhẹ nhàng, thích hợp tặng mẹ và người thân.'
  },

  // =========================
  // FLOWER VASE - BÌNH HOA
  // =========================
  {
    id: 11,
    code: 'FV01',
    type: 'flower-vase',
    categorySlug: 'binh-hoa-8-3',
    name: 'Bình hoa cao cấp đỏ',
    price: 2200000,
    image: '/images/binh-hoa-cao-cap-do.png',
    description: 'Bình hoa sang trọng với tông đỏ nổi bật, phù hợp các dịp trang trọng.'
  },
  {
    id: 12,
    code: 'FV02',
    type: 'flower-vase',
    categorySlug: 'binh-hoa-8-3',
    name: 'Bình hoa hồng phấn',
    price: 1800000,
    image: '/images/binh-hoa-hong-phan.png',
    description: 'Bình hoa hồng phấn nhẹ nhàng, phù hợp tặng mẹ hoặc trang trí không gian.'
  },
  {
    id: 13,
    code: 'FV03',
    type: 'flower-vase',
    categorySlug: 'binh-hoa-8-3',
    name: 'Bình hoa chúc mừng',
    price: 2400000,
    image: '/images/binh-hoa-chuc-mung-2.png',
    description: 'Thiết kế bình hoa cao cấp, phù hợp chúc mừng đối tác và sự kiện lớn.'
  },
  {
    id: 14,
    code: 'FV04',
    type: 'flower-vase',
    categorySlug: 'binh-hoa-8-3',
    name: 'Bình hoa nghệ thuật',
    price: 2600000,
    image: '/images/binh-hoa-nghe-thuat.png',
    description: 'Bình hoa được phối màu tinh tế, tạo cảm giác thanh lịch và hiện đại.'
  },
  {
    id: 15,
    code: 'FV05',
    type: 'flower-vase',
    categorySlug: 'binh-hoa-8-3',
    name: 'Bình hoa mùa xuân',
    price: 2100000,
    image: '/images/binh-hoa-mua-xuan.png',
    description: 'Bình hoa tươi sáng, mang cảm giác vui tươi và tràn đầy sức sống.'
  },

  // =========================
  // TULIP
  // =========================
  {
    id: 16,
    code: 'T01',
    type: 'tulip',
    categorySlug: 'tulip',
    name: 'Bó tulip hồng',
    price: 1200000,
    image: '/images/bo-tulip-hong.png',
    description: 'Bó tulip nhẹ nhàng, hiện đại, phù hợp cho sinh nhật và quà tặng.'
  },
  {
    id: 17,
    code: 'T02',
    type: 'tulip',
    categorySlug: 'tulip',
    name: 'Bó tulip cam',
    price: 1400000,
    image: '/images/bo-tulip-cam.png',
    description: 'Tulip cam rực rỡ, thích hợp làm quà chúc mừng và tạo điểm nhấn nổi bật.'
  },
  {
    id: 18,
    code: 'T03',
    type: 'tulip',
    categorySlug: 'tulip',
    name: 'Tulip trắng thanh lịch',
    price: 1350000,
    image: '/images/tuilip-thanh-lich.png',
    description: 'Tulip trắng mang vẻ đẹp nhẹ nhàng, phù hợp các dịp trang trọng.'
  },
  {
    id: 19,
    code: 'T04',
    type: 'tulip',
    categorySlug: 'tulip',
    name: 'Giỏ tulip sắc xuân',
    price: 1600000,
    image: '/images/gio-tulip-sac-xuan.png',
    description: 'Giỏ tulip phối sắc màu tươi trẻ, phù hợp tặng người thân và bạn bè.'
  },
  {
    id: 20,
    code: 'T05',
    type: 'tulip',
    categorySlug: 'tulip',
    name: 'Tulip cao cấp 8-3',
    price: 1800000,
    image: '/images/tulip-cao-cap.png',
    description: 'Mẫu tulip cao cấp dành cho dịp 8-3, sang trọng và ấn tượng.'
  },
  // =========================
  // HOA HỒNG
  // =========================
  {
    id: 21,
    code: 'R01',
    type: 'rose',
    categorySlug: 'hoa-hong',
    name: 'Bó hoa hồng đỏ lãng mạn',
    price: 950000,
    image: '/images/bo-hoa-hong-99-bong.png',
    description: 'Bó hoa hồng đỏ tượng trưng cho tình yêu sâu đậm và sự trân trọng chân thành.'
  },
  {
    id: 22,
    code: 'R02',
    type: 'rose',
    categorySlug: 'hoa-hong',
    name: 'Bó hoa hồng pastel dịu dàng',
    price: 980000,
    image: '/images/bo-hoa-hong-pastel-dep-1.png',
    description: 'Mẫu hoa hồng pastel nhẹ nhàng, phù hợp tặng người thân, bạn bè hoặc người yêu.'
  },
  {
    id: 23,
    code: 'R03',
    type: 'rose',
    categorySlug: 'hoa-hong',
    name: 'Giỏ hoa hồng ngọt ngào',
    price: 1350000,
    image: '/images/gio-hoa-hong-ngot-ngao.png',
    description: 'Giỏ hoa hồng thiết kế tinh tế, mang thông điệp yêu thương và sự quan tâm.'
  },
  {
    id: 24,
    code: 'R04',
    type: 'rose',
    categorySlug: 'hoa-hong',
    name: 'Bình hoa hồng sang trọng',
    price: 1850000,
    image: '/images/binh-hoa-hong-sang-trong.png',
    description: 'Bình hoa hồng cao cấp giúp không gian trở nên thanh lịch và nổi bật.'
  },
  {
    id: 25,
    code: 'R05',
    type: 'rose',
    categorySlug: 'hoa-hong',
    name: 'Bó hoa hồng 99 bông',
    price: 2600000,
    image: '/images/bo-hoa-hong-99-bong.png',
    description: 'Mẫu hoa hồng 99 bông thể hiện tình cảm mãnh liệt, phù hợp dịp kỷ niệm đặc biệt.'
  },

  // =========================
  // HOA HƯỚNG DƯƠNG
  // =========================
  {
    id: 26,
    code: 'S01',
    type: 'sunflower',
    categorySlug: 'hoa-huong-duong',
    name: 'Bó hoa hướng dương niềm tin',
    price: 890000,
    image: '/images/bo-hoa-huong-duong.png',
    description: 'Bó hoa hướng dương mang ý nghĩa niềm tin, hy vọng và nguồn năng lượng tích cực.'
  },
  {
    id: 27,
    code: 'S02',
    type: 'sunflower',
    categorySlug: 'hoa-huong-duong',
    name: 'Giỏ hoa hướng dương rực rỡ',
    price: 1450000,
    image: '/images/gio-hoa-huong-duong.png',
    description: 'Giỏ hoa hướng dương nổi bật, thích hợp tặng chúc mừng và động viên tinh thần.'
  },
  {
    id: 28,
    code: 'S03',
    type: 'sunflower',
    categorySlug: 'hoa-huong-duong',
    name: 'Bình hoa hướng dương cao cấp',
    price: 1950000,
    image: '/images/binh-hoa-huong-duong-cao-cap.png',
    description: 'Bình hoa hướng dương sang trọng, tượng trưng cho sự tôn kính và khởi đầu tươi sáng.'
  },
  {
    id: 29,
    code: 'S04',
    type: 'sunflower',
    categorySlug: 'hoa-huong-duong',
    name: 'Bó hướng dương chúc thành công',
    price: 920000,
    image: '/images/bo-hoa-huong-duong-chuc-thanh-cong.png',
    description: 'Thiết kế bó hoa hiện đại, phù hợp tặng bạn bè, đồng nghiệp trong dịp chúc mừng.'
  },
  {
    id: 30,
    code: 'S05',
    type: 'sunflower',
    categorySlug: 'hoa-huong-duong',
    name: 'Giỏ hướng dương ngày mới',
    price: 1380000,
    image: '/images/gio-hoa-huong-duong-ngay-moi.png',
    description: 'Giỏ hoa hướng dương mang cảm giác tươi mới, giúp lan tỏa niềm vui và sự lạc quan.'
  },

  // =========================
  // HOA CÁT TƯỜNG
  // =========================
  {
    id: 31,
    code: 'E01',
    type: 'eustoma',
    categorySlug: 'hoa-cat-tuong',
    name: 'Bó hoa cát tường may mắn',
    price: 880000,
    image: '/images/bo-hoa-cat-tuong-may-man.png',
    description: 'Hoa cát tường mang ý nghĩa may mắn và hạnh phúc, phù hợp làm quà tặng tinh tế.'
  },
  {
    id: 32,
    code: 'E02',
    type: 'eustoma',
    categorySlug: 'hoa-cat-tuong',
    name: 'Giỏ hoa cát tường thanh nhã',
    price: 1320000,
    image: '/images/gio-hoa-cat-tuong-thanh-nha.png',
    description: 'Giỏ hoa cát tường có gam màu nhẹ nhàng, thích hợp tặng mẹ và người thân.'
  },
  {
    id: 33,
    code: 'E03',
    type: 'eustoma',
    categorySlug: 'hoa-cat-tuong',
    name: 'Bình hoa cát tường dịu dàng',
    price: 1760000,
    image: '/images/binh-hoa-cat-tuong-diu-dang.png',
    description: 'Bình hoa cát tường tạo cảm giác trang nhã, phù hợp trang trí và làm quà chúc mừng.'
  },
  {
    id: 34,
    code: 'E04',
    type: 'eustoma',
    categorySlug: 'hoa-cat-tuong',
    name: 'Bó cát tường hồng nhẹ',
    price: 910000,
    image: '/images/bo-cat-tuong-hong-nhe.png',
    description: 'Thiết kế bó hoa cát tường nhẹ nhàng, mang vẻ đẹp nữ tính và tinh tế.'
  },
  {
    id: 35,
    code: 'E05',
    type: 'eustoma',
    categorySlug: 'hoa-cat-tuong',
    name: 'Giỏ cát tường chúc an vui',
    price: 1280000,
    image: '/images/gio-hoa-cat-tuong-an-vui.png',
    description: 'Mẫu giỏ hoa cát tường phù hợp tặng dịp chúc mừng, cầu chúc bình an và may mắn.'
  },

  // =========================
  // HOA LAN HỒ ĐIỆP
  // =========================
  {
    id: 36,
    code: 'O01',
    type: 'orchid',
    categorySlug: 'hoa-lan-ho-diep',
    name: 'Lan hồ điệp sang trọng',
    price: 2100000,
    image: '/images/lan-ho-diep-sang-trong.png',
    description: 'Lan hồ điệp mang vẻ đẹp sang trọng, tinh tế, phù hợp tặng đối tác và người thân.'
  },
  {
    id: 37,
    code: 'O02',
    type: 'orchid',
    categorySlug: 'hoa-lan-ho-diep',
    name: 'Chậu lan hồ điệp trắng',
    price: 2450000,
    image: '/images/chau-lan-ho-diep-trang.png',
    description: 'Chậu lan hồ điệp trắng thể hiện sự thanh cao, quý phái và hiện đại.'
  },
  {
    id: 38,
    code: 'O03',
    type: 'orchid',
    categorySlug: 'hoa-lan-ho-diep',
    name: 'Lan hồ điệp tím quý phái',
    price: 2680000,
    image: '/images/lan-ho-diep-tim-quy-phai.png',
    description: 'Sắc tím của lan hồ điệp tạo cảm giác quý phái, rất phù hợp cho các dịp trang trọng.'
  },
  {
    id: 39,
    code: 'O04',
    type: 'orchid',
    categorySlug: 'hoa-lan-ho-diep',
    name: 'Chậu lan hồ điệp chúc mừng',
    price: 2950000,
    image: '/images/chau-lan-ho-diep-chuc-mung.png',
    description: 'Mẫu chậu lan hồ điệp cao cấp thích hợp chúc mừng khai trương hoặc sự kiện đặc biệt.'
  },
  {
    id: 40,
    code: 'O05',
    type: 'orchid',
    categorySlug: 'hoa-lan-ho-diep',
    name: 'Lan hồ điệp vàng thịnh vượng',
    price: 2780000,
    image: '/images/lan-ho-diep-thinh-vuong.png',
    description: 'Lan hồ điệp vàng mang thông điệp thịnh vượng, thành công và vẻ đẹp đẳng cấp.'
  }
];

export default products;