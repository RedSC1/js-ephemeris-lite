program probe
  implicit none
  real*8 :: jd, r(3)
  integer :: status, ierr
  do
    read(*,*,iostat=status) jd
    if (status/=0) exit
    call ELP82B(jd,0d0,10,r,ierr)
    if (ierr/=0) stop 1
    write(*,'(3(es25.17,1x))') r
  enddo
end program
