#include "taiyin/bazi/bazi.h"
#include "taiyin/chinese_calendar/calendar.h"
#include "taiyin/runtime/runtime.h"
#include "taiyin/time.h"
#include <iostream>
#include <iomanip>
#include <cstdlib>
using namespace taiyin;
using namespace taiyin::bazi;
void check(Status s) {if(s!=TAIYIN_STATUS_OK){std::cerr<<s<<'\n';std::exit(3);}}
int main(int argc,char** argv) {
  if(argc!=2)return 2;
  const char* paths[]={argv[1]}; runtime::EphemerisRuntimeConfig cfg;
  cfg.source_paths=paths;cfg.source_path_count=1;cfg.load_packaged_data=false;
  if(!runtime::initialize_global_ephemeris_runtime(cfg))return 4;
  runtime::NativeCalcContext astronomy;
  check(runtime::native_context_set_geocentric_observer(&astronomy,399,399));
  chinese_calendar::ChineseCalendarContext calendar;
  auto cc=chinese_calendar::fixed_utc_offset_config(480);
  check(chinese_calendar::initialize_context(&calendar,&astronomy,&cc));
  std::cout<<std::setprecision(17);
  int y,m,gender,timeModel,boundary;
  while(std::cin>>y>>m>>gender>>timeModel>>boundary) {
    CalendarDateTime birth={y,m,19,gender?23:0,28,0};
    SplitJulianDate jd; if(!julian_day_split(birth,&jd))return 5;
    add_seconds_to_split_jd(jd,-480*60,&jd);
    chinese_calendar::GanzhiFourPillars pillars; runtime::EphemerisEvalDiagnostic diag;
    check(chinese_calendar::calculate_four_pillars(&calendar,jd,birth,chinese_calendar::TAIYIN_GANZHI_RAT_HOUR_NO_SPLIT,&pillars,&diag));
    BaziContextConfig config=default_context_config();config.qiyun_time_model=timeModel;config.dayun_boundary_model=boundary;
    BaziContext context;check(initialize_context(&context,&config));
    BaziChart chart;check(calculate_chart(&context,pillars,&chart));
    BaziQiYunResult q;check(calculate_qiyun(&context,&calendar,jd,birth,&chart,gender,&q,&diag));
    BaziDaYun decades[8];size_t count=0;check(fill_dayun(&context,birth,&chart,&q,8,decades,8,&count));
    std::cout<<"[["<<+pillars.year<<','<<+pillars.month<<','<<+pillars.day<<','<<+pillars.hour<<"],["
      <<q.direction<<','<<+q.reference_jie_index<<','<<q.jie_interval_days<<','<<q.start_age_years<<','
      <<split_julian_date_to_double(q.reference_jie_jd_ut)<<','<<split_julian_date_to_double(q.start_jd_ut)<<"],[";
    for(size_t i=0;i<count;i++) {
      if(i)std::cout<<',';
      std::cout<<'['<<+decades[i].ganzhi<<','<<decades[i].start_virtual_age<<','<<decades[i].end_virtual_age<<','
        <<split_julian_date_to_double(decades[i].start_jd_ut)<<','<<split_julian_date_to_double(decades[i].end_jd_ut)<<']';
    }
    std::cout<<"],[";
    for(int table=0;table<2;table++) {
      if(table)std::cout<<',';
      BaziRenyuanSilingSegment segments[8];check(get_renyuan_siling_segments(pillars.month&15,table,segments,8,&count));
      std::cout<<'[';
      for(size_t i=0;i<count;i++) {if(i)std::cout<<',';const auto& s=segments[i];std::cout<<'['<<+s.stem_id<<','<<+s.origin_kind<<','<<+s.segment_index<<','<<s.start_day<<','<<s.end_day<<']';}
      std::cout<<']';
    }
    std::cout<<"]]\n";
  }
}
